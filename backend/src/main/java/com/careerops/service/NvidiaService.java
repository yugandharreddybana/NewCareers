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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Unified AI service backed by NVIDIA NIM (OpenAI-compatible endpoint).
 *
 * Replaces both GeminiService (job matching) and ClaudeDirectService (single-turn skills).
 * All methods preserve the exact same output contract as the services they replace:
 *   - generateJsonAsync  → used by JobDeliveryService (was GeminiService)
 *   - generateJson       → used by skill handlers + CvHumanScoreService (was ClaudeDirectService)
 *   - generate           → raw text, used internally
 *
 * Retry: up to 3 attempts on 429, exponential back-off starting at 2 s.
 * Token usage: recorded via TokenUsageService for the /admin/token-usage dashboard.
 */
@Service
public class NvidiaService {

    private static final Logger log = LoggerFactory.getLogger(NvidiaService.class);
    private static final String BASE_URL = "https://integrate.api.nvidia.com/v1";

    @Value("${nvidia.api.key:}")
    private String apiKey;

    @Value("${nvidia.model:meta/llama-3.3-70b-instruct}")
    private String model;

    @Value("${nvidia.max.tokens:4096}")
    private int maxTokens;

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
        this.restClient        = builder
            .baseUrl(BASE_URL)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();
    }

    @PostConstruct
    public void init() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("NvidiaService: NVIDIA_API_KEY is not configured — AI calls will fail.");
        } else {
            log.info("NvidiaService: initialised with model={}", model);
        }
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
        ObjectNode body = buildBody(systemPrompt, userPrompt);
        return callWithRetry(body, userId, featureName);
    }

    // ─── JSON generation (replaces ClaudeDirectService.generateJson) ─────────

    public JsonNode generateJson(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        String raw = generate(systemPrompt, userPrompt, userId, featureName);
        return JsonExtractor.extract(raw, mapper);
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

    private ObjectNode buildBody(String systemPrompt, String userPrompt) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        // Force JSON output — equivalent to Gemini's responseMimeType: application/json
        body.set("response_format", mapper.createObjectNode().put("type", "json_object"));

        ArrayNode messages = mapper.createArrayNode();
        messages.addObject().put("role", "system").put("content", systemPrompt);
        messages.addObject().put("role", "user").put("content", userPrompt);
        body.set("messages", messages);
        return body;
    }

    // ─── HTTP call with retry + token tracking ────────────────────────────────

    private String callWithRetry(ObjectNode body, UUID userId, String featureName) {
        int  maxAttempts = 3;
        long backoffMs   = 2000;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String raw = meterRegistry.timer("ai.nvidia.call", "feature", featureName)
                    .record(() -> restClient.post()
                        .uri("/chat/completions")
                        .header("Authorization", "Bearer " + apiKey)
                        .body(body.toString())
                        .retrieve()
                        .body(String.class));

                if (raw == null) return "{}";
                JsonNode resp = mapper.readTree(raw);

                // Record token usage — same TokenUsageService contract as Gemini/Claude
                JsonNode usage = resp.path("usage");
                if (!usage.isMissingNode()) {
                    int    input  = usage.path("prompt_tokens").asInt(0);
                    int    output = usage.path("completion_tokens").asInt(0);
                    // NVIDIA NIM free tier: effectively $0; paid: ~$0.20/M tokens
                    double cost   = (input + output) * 0.0000002;
                    tokenUsageService.record(userId, featureName, model, input, output, cost);
                }

                // OpenAI format: choices[0].message.content
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
    }
}
