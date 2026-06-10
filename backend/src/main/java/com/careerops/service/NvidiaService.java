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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Semaphore;

/**
 * Unified AI service backed by NVIDIA NIM (OpenAI-compatible endpoint).
 *
 * Two-tier model routing:
 *   PREMIUM tier → nvidia/llama-3.3-nemotron-super-49b-v1  (~4s, near-70B quality)
 *     Used for: tailor-resume, cover-letter  (writing quality matters most)
 *   FAST tier    → nvidia/nemotron-3-nano-30b-a3b           (~1.6s, 3B active params)
 *     Used for: everything else (cv-parse, job-match, skills, research, etc.)
 *
 * Retries reduced to 1 (single retry on 429/transient error only).
 * Read timeout lowered to 45s for fast-tier, 120s for premium-tier.
 */
@Service
public class NvidiaService {

    /** Raw completion text plus token usage from one NVIDIA call. */
    public record LlmCallResult(String content, int totalTokens) {}

    private static final Logger log = LoggerFactory.getLogger(NvidiaService.class);
    private static final String BASE_URL = "https://integrate.api.nvidia.com/v1";

    /**
     * Features that require the premium model (quality-critical writing tasks).
     * Everything NOT in this set uses the fast model.
     */
    private static final Set<String> PREMIUM_FEATURES = Set.of(
            "tailor-resume",
            "cover-letter"
    );

    private static final Map<String, Integer> FAST_SKILL_MAX_TOKENS = Map.of(
            "research",              2500,
            "prep-interview",        2500,
            "compare",               1500,
            "onboarding-cv-parse",   3000,
            "job-match",             1200,
            "cv-human-score",        800,
            "cv-normalize",          4096,
            "outreach-draft",        1500,
            "apply-assist-question", 1200
    );

    @Value("${nvidia.api.key:}")
    private String apiKey;

    /** Premium model — high quality writing (tailor-resume, cover-letter). */
    @Value("${nvidia.model.premium:nvidia/llama-3.3-nemotron-super-49b-v1}")
    private String premiumModel;

    /** Fast model — low-latency structured tasks (CV parse, job match, skills, etc.). */
    @Value("${nvidia.model.fast:nvidia/nemotron-3-nano-30b-a3b}")
    private String fastModel;

    /** Legacy single-model override — if set, overrides both tiers (backwards compat). */
    @Value("${nvidia.model:}")
    private String legacyModel;

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

    /** Read timeout for FAST tier (ms). */
    @Value("${nvidia.read.timeout.fast.ms:45000}")
    private int fastReadTimeoutMs;

    /** Read timeout for PREMIUM tier (ms). */
    @Value("${nvidia.read.timeout.premium.ms:120000}")
    private int premiumReadTimeoutMs;

    @Value("${nvidia.connect.timeout.ms:10000}")
    private int connectTimeoutMs;

    private Semaphore callSemaphore;

    private RestClient fastRestClient;
    private RestClient premiumRestClient;
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
        SimpleClientHttpRequestFactory fastFactory = new SimpleClientHttpRequestFactory();
        fastFactory.setConnectTimeout(connectTimeoutMs);
        fastFactory.setReadTimeout(fastReadTimeoutMs);
        this.fastRestClient = restClientBuilder.clone().requestFactory(fastFactory).build();

        SimpleClientHttpRequestFactory premiumFactory = new SimpleClientHttpRequestFactory();
        premiumFactory.setConnectTimeout(connectTimeoutMs);
        premiumFactory.setReadTimeout(premiumReadTimeoutMs);
        this.premiumRestClient = restClientBuilder.clone().requestFactory(premiumFactory).build();

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("NvidiaService: NVIDIA_API_KEY is not configured — AI calls will fail.");
        } else {
            log.info("NvidiaService: initialised premiumModel={} fastModel={} maxConcurrent={} fastTimeoutMs={} premiumTimeoutMs={}",
                resolveModel("tailor-resume"), resolveModel("onboarding-cv-parse"),
                maxConcurrent, fastReadTimeoutMs, premiumReadTimeoutMs);
        }
        callSemaphore = new Semaphore(Math.max(1, maxConcurrent));
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * Resolves the model to use for a given feature.
     * If the legacy nvidia.model property is set (non-blank), it overrides both tiers.
     * Otherwise, PREMIUM_FEATURES get the premium model; all others get the fast model.
     */
    private String resolveModel(String featureName) {
        if (legacyModel != null && !legacyModel.isBlank()) {
            return legacyModel;
        }
        String skill = NvidiaRequestSupport.normalizeSkill(featureName);
        return PREMIUM_FEATURES.contains(skill) ? premiumModel : fastModel;
    }

    private RestClient resolveRestClient(String featureName) {
        if (legacyModel != null && !legacyModel.isBlank()) {
            return premiumRestClient;
        }
        String skill = NvidiaRequestSupport.normalizeSkill(featureName);
        return PREMIUM_FEATURES.contains(skill) ? premiumRestClient : fastRestClient;
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
        body.put("model", resolveModel(featureName));
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
        // Single retry: attempt once, retry once on 429 or transient error only.
        int  maxAttempts = 2;
        long backoffMs   = 1000;
        boolean acquired = false;
        RestClient client = resolveRestClient(featureName);
        String resolvedModel = resolveModel(featureName);
        try {
            callSemaphore.acquire();
            acquired = true;
            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    String raw = meterRegistry.timer("ai.nvidia.call", "feature", featureName, "model", resolvedModel)
                        .record(() -> client.post()
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
                            tokenUsageService.record(userId, featureName, resolvedModel, input, output, cost);
                        } else {
                            log.info("NvidiaService pre-auth usage feature={} model={} inputTokens={} outputTokens={} costUsd={}",
                                featureName, resolvedModel, input, output, cost);
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
                        log.warn("NvidiaService: rate limited on feature={}, retrying once", featureName);
                    } else if (attempt == maxAttempts) {
                        throw com.careerops.exception.ApiException.internalError("NVIDIA API error: " + status);
                    }
                    try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                } catch (Exception e) {
                    if (attempt == maxAttempts) {
                        throw com.careerops.exception.ApiException.internalError("NvidiaService failed: " + e.getMessage());
                    }
                    log.warn("NvidiaService: call failed on feature={}, retrying once: {}", featureName, e.getMessage());
                    try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
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
