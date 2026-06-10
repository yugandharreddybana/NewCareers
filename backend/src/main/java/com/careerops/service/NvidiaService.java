package com.careerops.service;

import com.careerops.dto.LlmJsonResult;
import com.careerops.util.JsonExtractor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Semaphore;

/**
 * Unified AI service backed by NVIDIA NIM (OpenAI-compatible endpoint).
 *
 * Replaces both GeminiService (job matching) and ClaudeDirectService (single-turn skills).
 * All methods preserve the exact same output contract as the services they replace:
 *   - generateJsonAsync  → used by JobDeliveryService (was GeminiService)
 *   - generateJson       → used by skill handlers + CvHumanScoreService (was ClaudeDirectService)
 *   - generate           → raw text, used internally
 *
 * Nemotron 3 Ultra: thinking enabled for tailor-resume, cover-letter, evaluate, skills-gap-plan.
 * Fast path (no thinking) for job-match, onboarding-cv-parse, and other features.
 */
@Service
public class NvidiaService {

    /** Raw completion text plus token usage from one NVIDIA call. */
    public record LlmCallResult(String content, int totalTokens) {}

    private static final Logger log = LoggerFactory.getLogger(NvidiaService.class);
    private static final String BASE_URL = "https://integrate.api.nvidia.com/v1";

    private static final Map<String, Integer> FAST_SKILL_MAX_TOKENS = Map.of(
            "research",           2500,
            "prep-interview",     2500,
            "compare",            1500,
            "onboarding-cv-parse", 6000,
            "job-match",          1200,
            "cv-human-score",     800,
            "cv-normalize",       4096,
            "outreach-draft",     1500,
            "apply-assist-question", 1200
    );

    @Value("${nvidia.api.key:}")
    private String apiKey;

    @Value("${nvidia.model:nvidia/nemotron-3-ultra-550b-a55b}")
    private String model;

    @Value("${nvidia.max.tokens:16384}")
    private int maxTokens;

    @Value("${nvidia.reasoning.budget:8192}")
    private int reasoningBudget;

    @Value("${nvidia.temperature:1}")
    private double temperature;

    @Value("${nvidia.top_p:0.95}")
    private double topP;

    @Value("${nvidia.max.concurrent:5}")
    private int maxConcurrent;

    @Value("${nvidia.read.timeout.ms:300000}")
    private int readTimeoutMs;

    @Value("${nvidia.connect.timeout.ms:10000}")
    private int connectTimeoutMs;

    private Semaphore callSemaphore;

    private RestClient restClient;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper        mapper;
    private final TokenUsageService   tokenUsageService;
    private final UserConsentService  consentService;
    private final MeterRegistry       meterRegistry;

    public NvidiaService(RestClient.Builder builder,
                         ObjectMapper mapper,
                         TokenUsageService tokenUsageService,
                         UserConsentService consentService,
                         MeterRegistry meterRegistry) {
        this.mapper            = mapper;
        this.tokenUsageService = tokenUsageService;
        this.consentService    = consentService;
        this.meterRegistry     = meterRegistry;
        this.restClientBuilder = builder
            .baseUrl(BASE_URL)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
    }

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restClient = restClientBuilder.requestFactory(factory).build();

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("NvidiaService: NVIDIA_API_KEY is not configured — AI calls will fail.");
        } else {
            log.info("NvidiaService: initialised with model={} maxTokens={} maxConcurrent={} readTimeoutMs={}",
                model, maxTokens, maxConcurrent, readTimeoutMs);
        }
        callSemaphore = new Semaphore(Math.max(1, maxConcurrent));
        log.info("NvidiaService: max concurrent calls={}", maxConcurrent);
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    private NvidiaRequestSupport.NemotronConfig nemotronConfig() {
        return new NvidiaRequestSupport.NemotronConfig(maxTokens, reasoningBudget, temperature, topP);
    }

    // ─── Core text generation ────────────────────────────────────────────────

    public String generate(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        if (apiKey == null || apiKey.isBlank()) {
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (NVIDIA NIM)");
        }
        ObjectNode body = buildBody(systemPrompt, userPrompt, featureName);
        return callWithRetry(body, userId, featureName).content();
    }

    // ─── JSON generation (replaces ClaudeDirectService.generateJson) ─────────

    public JsonNode generateJson(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        return generateJsonWithUsage(systemPrompt, userPrompt, userId, featureName).json();
    }

    public LlmJsonResult generateJsonWithUsage(
            String systemPrompt, String userPrompt, UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        if (apiKey == null || apiKey.isBlank()) {
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (NVIDIA NIM)");
        }
        ObjectNode body = buildBody(systemPrompt, userPrompt, featureName);
        LlmCallResult call = callWithRetry(body, userId, featureName);
        return new LlmJsonResult(JsonExtractor.extract(call.content(), mapper), call.totalTokens());
    }

    public JsonNode generateJsonWithoutUserConsent(String systemPrompt, String userPrompt, String featureName) {
        if (apiKey == null || apiKey.isBlank()) {
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (NVIDIA NIM)");
        }
        ObjectNode body = buildBody(systemPrompt, userPrompt, featureName);
        LlmCallResult call = callWithRetry(body, null, featureName);
        return JsonExtractor.extract(call.content(), mapper);
    }

    public String generatePlainText(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        if (apiKey == null || apiKey.isBlank()) {
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (NVIDIA NIM)");
        }
        ObjectNode body = buildPlainBody(systemPrompt, userPrompt, featureName);
        return callWithRetry(body, userId, featureName).content();
    }

    // ─── Async JSON generation (replaces GeminiService.generateJsonAsync) ────

    public CompletableFuture<JsonNode> generateJsonAsync(String systemPrompt, String userPrompt,
                                                          UUID userId, String featureName) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String raw = generate(systemPrompt, userPrompt, userId, featureName);
                return JsonExtractor.extract(raw, mapper);
            } catch (Exception e) {
                log.warn("NvidiaService JSON async failed for user={} feature={}: {}", userId, featureName, e.getMessage());
                return mapper.createObjectNode();
            }
        });
    }

    // ─── Request builder ─────────────────────────────────────────────────────

    private ObjectNode buildBody(String systemPrompt, String userPrompt, String featureName) {
        ObjectNode body = buildPlainBody(systemPrompt, userPrompt, featureName);
        body.set("response_format", mapper.createObjectNode().put("type", "json_object"));
        return body;
    }

    private ObjectNode buildPlainBody(String systemPrompt, String userPrompt, String featureName) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", NvidiaRequestSupport.resolveMaxTokens(
                featureName, FAST_SKILL_MAX_TOKENS, maxTokens, 4096));
        ArrayNode messages = mapper.createArrayNode();
        messages.addObject().put("role", "system").put("content", systemPrompt);
        messages.addObject().put("role", "user").put("content", userPrompt);
        body.set("messages", messages);
        NvidiaRequestSupport.applyNemotronOptions(body, featureName, false, nemotronConfig(), mapper);
        return body;
    }

    // ─── HTTP call with retry + token tracking ────────────────────────────────

    private LlmCallResult callWithRetry(ObjectNode body, UUID userId, String featureName) {
        int  maxAttempts = 3;
        long backoffMs   = 1000;
        boolean acquired = false;
        try {
            callSemaphore.acquire();
            acquired = true;
            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    String raw = meterRegistry.timer("ai.nvidia.call", "feature", featureName)
                        .record(() -> restClient.post()
                            .uri("/chat/completions")
                            .header("Authorization", "Bearer " + apiKey)
                            .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                            .body(body.toString())
                            .retrieve()
                            .body(String.class));
                    if (raw == null || raw.isBlank()) return new LlmCallResult("{}", 0);
                    JsonNode resp = mapper.readTree(raw);

                    int totalTokens = 0;
                    JsonNode usage = resp.path("usage");
                    if (!usage.isMissingNode()) {
                        int    input  = usage.path("prompt_tokens").asInt(0);
                        int    output = usage.path("completion_tokens").asInt(0);
                        totalTokens = input + output;
                        double cost   = totalTokens * 0.0000002;
                        if (userId != null) {
                            tokenUsageService.record(userId, featureName, model, input, output, cost);
                        } else {
                            log.info("NvidiaService pre-auth usage feature={} inputTokens={} outputTokens={} costUsd={}",
                                featureName, input, output, cost);
                        }
                    }

                    String content = resp.path("choices").path(0)
                               .path("message").path("content").asText("{}");
                    return new LlmCallResult(content, totalTokens);

                } catch (RestClientResponseException e) {
                    int status = e.getStatusCode().value();
                    if (status == 401) {
                        log.error("NvidiaService: invalid API key (401)");
                        throw com.careerops.exception.ApiException.internalError("Invalid NVIDIA API key");
                    }
                    if (status == 429) {
                        if (attempt == maxAttempts) {
                            throw com.careerops.exception.ApiException
                                .tooManyRequests("AI engine is currently overloaded. Please try again later.", null);
                        }
                        log.warn("NvidiaService: rate limited, retrying (attempt {})", attempt);
                    } else if (attempt == maxAttempts) {
                        throw com.careerops.exception.ApiException.internalError("NVIDIA API error: " + status);
                    }
                    try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    backoffMs *= 2;
                } catch (Exception e) {
                    if (attempt == maxAttempts) {
                        throw com.careerops.exception.ApiException.internalError("NvidiaService failed: " + e.getMessage());
                    }
                    log.warn("NvidiaService: call failed, retrying (attempt {}): {}", attempt, e.getMessage());
                    try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    backoffMs *= 2;
                }
            }
            throw com.careerops.exception.ApiException.internalError("Max retries exceeded");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw com.careerops.exception.ApiException.internalError("AI call interrupted");
        } finally {
            if (acquired) {
                callSemaphore.release();
            }
        }
    }
}
