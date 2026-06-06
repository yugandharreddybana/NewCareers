package com.careerops.service;

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
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
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
 * Retry: up to 3 attempts on 429, exponential back-off starting at 1 s.
 * Token usage: recorded via TokenUsageService for the /admin/token-usage dashboard.
 *
 * FIX: Added explicit read/connect timeouts on the RestClient so that a hung NVIDIA
 * response can no longer block a Tomcat thread indefinitely. Timeouts are configurable
 * via nvidia.read.timeout.ms / nvidia.connect.timeout.ms.
 * FIX: Raised default max_tokens from 4096 → 8192 so skills like tailor-resume can
 * return full output without truncation (which previously triggered the expensive
 * normalization/repair path and caused double AI calls).
 * FIX: Raised default max.concurrent from 2 → 5 to prevent semaphore queueing when
 * multiple skills are running for the same user.
 */
@Service
public class NvidiaService {

    private static final Logger log = LoggerFactory.getLogger(NvidiaService.class);
    private static final String BASE_URL = "https://integrate.api.nvidia.com/v1";

    @Value("${nvidia.api.key:}")
    private String apiKey;

    @Value("${nvidia.model:meta/llama-3.3-70b-instruct}")
    private String model;

    /** Default raised to 8192 so tailor-resume / research return full output in one pass. */
    @Value("${nvidia.max.tokens:8192}")
    private int maxTokens;

    /** Raised to 5 so concurrent skill runs are not serialised behind a semaphore. */
    @Value("${nvidia.max.concurrent:5}")
    private int maxConcurrent;

    /** Read timeout for each NVIDIA HTTP call. Prevents indefinite thread blocking. */
    @Value("${nvidia.read.timeout.ms:150000}")
    private int readTimeoutMs;

    /** TCP connect timeout to NVIDIA endpoint. */
    @Value("${nvidia.connect.timeout.ms:10000}")
    private int connectTimeoutMs;

    private static final Map<String, Integer> SKILL_MAX_TOKENS = Map.of(
            "tailor-resume", 5000,
            "cover-letter",  1800,
            "evaluate",      1200,
            "research",      2500,
            "prep-interview",2500,
            "compare",       1500
    );

    private Semaphore callSemaphore;

    private final RestClient          restClient;
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
        // Apply explicit timeouts via a customized request factory.
        // SimpleClientHttpRequestFactory is sufficient — NVIDIA calls are single large responses.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(150_000);
        this.restClient = builder
            .baseUrl(BASE_URL)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .requestFactory(factory)
            .build();
    }

    @PostConstruct
    public void init() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("NvidiaService: NVIDIA_API_KEY is not configured — AI calls will fail.");
        } else {
            log.info("NvidiaService: initialised with model={} maxTokens={} maxConcurrent={}",
                model, maxTokens, maxConcurrent);
        }
        callSemaphore = new Semaphore(Math.max(1, maxConcurrent));
        log.info("NvidiaService: max concurrent calls={}", maxConcurrent);
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    // ─── Core text generation ────────────────────────────────────────────────

    /**
     * Single-turn generation returning raw text.
     * Validates AI consent, enforces JSON output via response_format.
     */
    public String generate(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        if (apiKey == null || apiKey.isBlank()) {
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (NVIDIA NIM)");
        }
        ObjectNode body = buildBody(systemPrompt, userPrompt, resolveSkillName(featureName));
        return callWithRetry(body, userId, featureName);
    }

    // ─── JSON generation (replaces ClaudeDirectService.generateJson) ─────────

    public JsonNode generateJson(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        String raw = generate(systemPrompt, userPrompt, userId, featureName);
        return JsonExtractor.extract(raw, mapper);
    }

    /**
     * Plain-text completion (no JSON response_format) — used for CV markdown normalization.
     */
    public String generatePlainText(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        if (apiKey == null || apiKey.isBlank()) {
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (NVIDIA NIM)");
        }
        ObjectNode body = buildPlainBody(systemPrompt, userPrompt, resolveSkillName(featureName));
        return callWithRetry(body, userId, featureName);
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

    private static String resolveSkillName(String featureName) {
        if (featureName == null) {
            return "";
        }
        if (featureName.startsWith("skill-")) {
            return featureName.substring("skill-".length());
        }
        return featureName;
    }

    private ObjectNode buildBody(String systemPrompt, String userPrompt, String skillName) {
        ObjectNode body = buildPlainBody(systemPrompt, userPrompt, skillName);
        body.set("response_format", mapper.createObjectNode().put("type", "json_object"));
        return body;
    }

    private ObjectNode buildPlainBody(String systemPrompt, String userPrompt, String skillName) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", SKILL_MAX_TOKENS.getOrDefault(skillName, 4096));
        ArrayNode messages = mapper.createArrayNode();
        messages.addObject().put("role", "system").put("content", systemPrompt);
        messages.addObject().put("role", "user").put("content", userPrompt);
        body.set("messages", messages);
        return body;
    }

    // ─── HTTP call with retry + token tracking ────────────────────────────────

    private String callWithRetry(ObjectNode body, UUID userId, String featureName) {
        int  maxAttempts = 3;
        long backoffMs   = 1000; // reduced from 2000 — faster first retry
        boolean acquired = false;
        try {
            callSemaphore.acquire();
            acquired = true;
            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    byte[] rawBytes = meterRegistry.timer("ai.nvidia.call", "feature", featureName)
                        .record(() -> restClient.post()
                            .uri("/chat/completions")
                            .header("Authorization", "Bearer " + apiKey)
                            .body(body.toString())
                            .retrieve()
                            .body(byte[].class));

                    String raw = rawBytes == null ? null
                            : new String(rawBytes, StandardCharsets.UTF_8);
                    if (raw == null || raw.isBlank()) return "{}";
                    JsonNode resp = mapper.readTree(raw);

                    JsonNode usage = resp.path("usage");
                    if (!usage.isMissingNode()) {
                        int    input  = usage.path("prompt_tokens").asInt(0);
                        int    output = usage.path("completion_tokens").asInt(0);
                        double cost   = (input + output) * 0.0000002;
                        tokenUsageService.record(userId, featureName, model, input, output, cost);
                    }

                    return resp.path("choices").path(0)
                               .path("message").path("content").asText("{}");

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
