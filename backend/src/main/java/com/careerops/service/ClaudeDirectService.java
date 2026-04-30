package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;

/**
 * Single-turn Claude call that enforces JSON output.
 * Used by Phase 2 skill handlers (salary, culture-fit, linkedin-optimize, cover-letter, skills-gap-plan)
 * and CvHumanScoreService.
 *
 * Unlike ClaudeAgentService (multi-turn tool loop), this is a direct one-shot call:
 *   system prompt + user prompt → JSON response.
 *
 * Retry: up to 3 attempts on 429/529, exponential back-off starting at 2s.
 */
@Service
public class ClaudeDirectService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeDirectService.class);
    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    @Value("${anthropic.api.key}")
    private String apiKey;

    @Value("${anthropic.model:claude-opus-4-5}")
    private String model;

    @Value("${anthropic.direct.max.tokens:4096}")
    private int maxTokens;

    @Value("${anthropic.call.timeout.seconds:120}")
    private int timeoutSeconds;

    private final WebClient webClient;
    private final ObjectMapper mapper;

    public ClaudeDirectService(ObjectMapper mapper) {
        this.mapper = mapper;
        this.webClient = WebClient.builder()
                .baseUrl(ANTHROPIC_API_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    /**
     * Calls Claude with a system prompt and user prompt, returns parsed JsonNode.
     * System prompt MUST instruct Claude to return only valid JSON.
     * Falls back to a text-wrapped node on parse failure.
     */
    public JsonNode generateJson(String systemPrompt, String userPrompt) {
        String raw = generate(systemPrompt, userPrompt);
        String cleaned = stripCodeFences(raw);
        try {
            return mapper.readTree(cleaned);
        } catch (Exception e) {
            log.warn("ClaudeDirectService: JSON parse failed — wrapping as text. raw={}",
                    raw.length() > 200 ? raw.substring(0, 200) + "..." : raw);
            ObjectNode fallback = mapper.createObjectNode();
            fallback.put("raw", raw);
            fallback.put("parseError", e.getMessage());
            return fallback;
        }
    }

    /**
     * Raw text call — returns Claude's response as a plain string.
     */
    public String generate(String systemPrompt, String userPrompt) {
        if (apiKey == null || apiKey.isBlank() || apiKey.startsWith("YOUR_")) {
            log.warn("ClaudeDirectService: API key not configured — returning stub");
            return "{\"stub\":true,\"note\":\"Anthropic API key not configured\"}";
        }

        ObjectNode body = mapper.createObjectNode();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("system",     systemPrompt);

        var messages = mapper.createArrayNode();
        var userMsg  = mapper.createObjectNode();
        userMsg.put("role", "user");
        var content = mapper.createArrayNode();
        var textBlock = mapper.createObjectNode();
        textBlock.put("type", "text");
        textBlock.put("text", userPrompt);
        content.add(textBlock);
        userMsg.set("content", content);
        messages.add(userMsg);
        body.set("messages", messages);

        return callWithRetry(body);
    }

    private String callWithRetry(ObjectNode body) {
        int attempts = 0;
        int maxAttempts = 3;
        long delayMs = 2000;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                String responseStr = webClient.post()
                        .header("x-api-key",        apiKey)
                        .header("anthropic-version", ANTHROPIC_VERSION)
                        .bodyValue(body.toString())
                        .retrieve()
                        .bodyToMono(String.class)
                        .timeout(Duration.ofSeconds(timeoutSeconds))
                        .block();

                if (responseStr == null) return "{}";
                JsonNode resp = mapper.readTree(responseStr);

                StringBuilder sb = new StringBuilder();
                for (JsonNode block : resp.path("content")) {
                    if ("text".equals(block.path("type").asText())) {
                        sb.append(block.path("text").asText());
                    }
                }
                return sb.toString().trim();

            } catch (WebClientResponseException e) {
                int status = e.getStatusCode().value();
                if (status == 401) {
                    log.error("ClaudeDirectService: invalid API key (401)");
                    return "{\"error\":\"Invalid Anthropic API key\"}";
                }
                if ((status == 429 || status == 529) && attempts < maxAttempts) {
                    log.warn("ClaudeDirectService: rate limited ({}), retrying in {}ms ({}/{})",
                            status, delayMs, attempts, maxAttempts);
                    try { Thread.sleep(delayMs); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return "{\"error\":\"Interrupted\"}";
                    }
                    delayMs *= 2;
                    continue;
                }
                log.error("ClaudeDirectService: API error {}: {}", status, e.getResponseBodyAsString());
                return "{\"error\":\"Claude API error " + status + "\"}";
            } catch (Exception e) {
                log.error("ClaudeDirectService: call failed: {}", e.getMessage(), e);
                return "{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}";
            }
        }
        return "{\"error\":\"Max retries exceeded\"}";
    }

    private String stripCodeFences(String raw) {
        if (raw == null) return "{}";
        String s = raw.trim();
        if (s.startsWith("```json")) s = s.substring(7);
        else if (s.startsWith("```"))  s = s.substring(3);
        if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
        return s.trim();
    }
}
