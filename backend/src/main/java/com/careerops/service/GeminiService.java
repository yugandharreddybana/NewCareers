package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class GeminiService {
    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final WebClient client;
    private final String key;
    private final String model;
    private final ObjectMapper mapper = new ObjectMapper();

    public GeminiService(WebClient.Builder b,
                         @Value("${gemini.api.key}") String key,
                         @Value("${gemini.model}") String model,
                         @Value("${gemini.endpoint}") String endpoint) {
        this.client = b.baseUrl(endpoint).build();
        this.key = key; this.model = model;
    }

    /** Single-turn synchronous call returning the raw text from Gemini. */
    public String generate(String systemPrompt, String userPrompt) {
        if (key == null || key.isBlank() || key.startsWith("YOUR_")) {
            log.warn("Gemini key missing — returning stub");
            return "{\"stub\":true,\"note\":\"Gemini key not configured\"}";
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
                .bodyValue(body)
                .retrieve().bodyToMono(JsonNode.class)
                .block(Duration.ofSeconds(60));
            if (resp == null) return "{}";
            JsonNode parts = resp.path("candidates").path(0).path("content").path("parts");
            if (parts.isArray() && parts.size() > 0) return parts.get(0).path("text").asText("{}");
            return "{}";
        } catch (Exception e) {
            log.warn("Gemini call failed: {}", e.getMessage());
            return "{\"error\":\"" + e.getMessage().replace("\"","'") + "\"}";
        }
    }

    /**
     * Async variant — runs on Spring's async executor so calling threads are
     * not blocked. Use this when scoring multiple jobs in a fetch batch.
     *
     * Requires @EnableAsync on CareerOpsApplication (or any @Configuration class).
     */
    @Async
    public CompletableFuture<String> generateAsync(String systemPrompt, String userPrompt) {
        return CompletableFuture.completedFuture(generate(systemPrompt, userPrompt));
    }

    /** Async variant that resolves directly to a parsed JsonNode. */
    @Async
    public CompletableFuture<JsonNode> generateJsonAsync(String systemPrompt, String userPrompt) {
        return CompletableFuture.completedFuture(generateJson(systemPrompt, userPrompt));
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
