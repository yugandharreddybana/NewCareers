package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class GeminiService {
    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final RestClient client;
    private final String key;
    private final String model;
    private final ObjectMapper mapper;
    private final TokenUsageService tokenUsageService;
    private final UserConsentService consentService;
    private final io.micrometer.core.instrument.MeterRegistry meterRegistry;
    private final boolean stubMode;
 
    public GeminiService(RestClient.Builder b,
                         @Value("${gemini.api.key:}") String key,
                         @Value("${gemini.model}") String model,
                         @Value("${gemini.endpoint}") String endpoint,
                         @Value("${gemini.stub:false}") boolean stubProp,
                         org.springframework.core.env.Environment env,
                         ObjectMapper mapper,
                         TokenUsageService tokenUsageService,
                         UserConsentService consentService,
                         io.micrometer.core.instrument.MeterRegistry meterRegistry) {
        this.client = b.baseUrl(endpoint).build();
        this.key = key; this.model = model;
        this.mapper = mapper;
        this.tokenUsageService = tokenUsageService;
        this.consentService = consentService;
        this.meterRegistry = meterRegistry;
        this.stubMode = stubProp || java.util.Arrays.asList(env.getActiveProfiles()).contains("stub") || java.util.Arrays.asList(env.getActiveProfiles()).contains("test");
    }

    @jakarta.annotation.PostConstruct
    public void init() {
        if ((key == null || key.isBlank()) && !stubMode) {
            log.warn("GeminiService: API key is not configured and stub mode is disabled! Gemini calls will fail.");
        }
    }

    public String generate(String systemPrompt, String userPrompt, java.util.UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        if (stubMode) {
            log.info("GeminiService: Stub mode active for generate. Returning mock response.");
            return "{\"match\": true, \"score\": 85, \"reasons\": [\"Strong matching experience\"]}";
        }
        if (key == null || key.isBlank()) {
            log.error("GeminiService: API key not configured");
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (Gemini)");
        }
        Map<String,Object> body = Map.of(
            "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
            "contents", List.of(Map.of("role","user","parts", List.of(Map.of("text", userPrompt)))),
            "generationConfig", Map.of("temperature", 0.4, "responseMimeType","application/json")
        );
        try {
            JsonNode resp = meterRegistry.timer("ai.gemini.call", "feature", featureName)
                .record(() -> client.post()
                    .uri("/{m}:generateContent?key={k}", model, key)
                    .header("Content-Type","application/json")
                    .body(body)
                    .retrieve().body(JsonNode.class));
            if (resp == null) return "{}";
            
            // 3.075 — Record token usage
            JsonNode usage = resp.path("usageMetadata");
            if (!usage.isMissingNode()) {
                int input  = usage.path("promptTokenCount").asInt(0);
                int output = usage.path("candidatesTokenCount").asInt(0);
                // Approximate cost for Flash: $0.10/M input, $0.40/M output
                double cost = (input * 0.0000001) + (output * 0.0000004);
                tokenUsageService.record(userId, featureName, model, input, output, cost);
            }

            JsonNode parts = resp.path("candidates").path(0).path("content").path("parts");
            if (parts.isArray() && parts.size() > 0) return parts.get(0).path("text").asText("{}");
            return "{}";
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "Unknown error" : e.getMessage();
            // 3.051 — Sanitize API key from logs
            String sanitized = msg.replaceAll("key=[^&\\s]+", "key=***");
            log.warn("Gemini call failed: {}", sanitized);
            // 3.073 — Build robust error JSON via mapper
            return mapper.createObjectNode().put("error", sanitized).toString();
        }
    }

    public String generate(String prompt, java.util.UUID userId, String featureName) {
        return generate("You are a helpful assistant.", prompt, userId, featureName);
    }

    public String generateContent(String prompt, java.util.UUID userId, String featureName) {
        return generate(prompt, userId, featureName);
    }

    /**
     * Async variant — now truly non-blocking (3.052).
     */
    public CompletableFuture<String> generateAsync(String systemPrompt, String userPrompt) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return generate(systemPrompt, userPrompt);
            } catch (Exception e) {
                log.warn("Gemini async call failed: {}", e.getMessage());
                return "{\"error\":\"Async call failed\"}";
            }
        });
    }

    /** Async variant that resolves directly to a parsed JsonNode (3.052). */
    public CompletableFuture<JsonNode> generateJsonAsync(String systemPrompt, String userPrompt, java.util.UUID userId, String featureName) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String raw = generate(systemPrompt, userPrompt, userId, featureName);
                // 3.072 — Use shared utility for robust extraction
                return com.careerops.util.JsonExtractor.extract(raw, mapper);
            } catch (Exception e) {
                log.warn("Gemini JSON async failed: {}", e.getMessage());
                return mapper.createObjectNode();
            }
        });
    }

    public String generate(String systemPrompt, String userPrompt) {
        if (stubMode) {
            log.info("GeminiService: Stub mode active for generate. Returning mock response.");
            return "{\"match\": true, \"score\": 85, \"reasons\": [\"Strong matching experience\"]}";
        }
        if (key == null || key.isBlank()) {
            log.error("GeminiService: API key not configured");
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (Gemini)");
        }
        Map<String,Object> body = Map.of(
            "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
            "contents", List.of(Map.of("role","user","parts", List.of(Map.of("text", userPrompt)))),
            "generationConfig", Map.of("temperature", 0.4, "responseMimeType","application/json")
        );
        try {
            JsonNode resp = client.post()
                .uri("/{m}:generateContent?key={k}", model, key)
                .header("Content-Type","application/json")
                .body(body)
                .retrieve().body(JsonNode.class);
            if (resp == null) return "{}";
            
            JsonNode parts = resp.path("candidates").path(0).path("content").path("parts");
            if (parts.isArray() && parts.size() > 0) return parts.get(0).path("text").asText("{}");
            return "{}";
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "Unknown error" : e.getMessage();
            String sanitized = msg.replaceAll("key=[^&\\s]+", "key=***");
            log.warn("Gemini call failed: {}", sanitized);
            return mapper.createObjectNode().put("error", sanitized).toString();
        }
    }

    /** Convenience parse to JsonNode. Falls back to text-wrapped node on parse failure. */
    public JsonNode generateJson(String systemPrompt, String userPrompt) {
        String raw = generate(systemPrompt, userPrompt);
        try { return mapper.readTree(raw); }
        catch (Exception e) {
            return mapper.createObjectNode().put("text", raw);
        }
    }
}
