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
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import java.util.UUID;

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

    private final RestClient restClient;
    private final ObjectMapper mapper;
    private final TokenUsageService tokenUsageService;
    private final UserConsentService consentService;
    private final MeterRegistry meterRegistry;

    public ClaudeDirectService(RestClient.Builder builder, ObjectMapper mapper, TokenUsageService tokenUsageService, UserConsentService consentService, MeterRegistry meterRegistry) {
        this.mapper = mapper;
        this.tokenUsageService = tokenUsageService;
        this.consentService = consentService;
        this.meterRegistry = meterRegistry;
        this.restClient = builder
                .baseUrl(ANTHROPIC_API_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /**
     * Calls Claude with a system prompt and user prompt, returns parsed JsonNode.
     * System prompt MUST instruct Claude to return only valid JSON.
     * Falls back to a text-wrapped node on parse failure.
     */
    public JsonNode generateJson(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        consentService.validateAiConsent(userId);
        String raw = generate(systemPrompt, userPrompt, userId, featureName);
        // 3.072 — Use shared utility for robust extraction
        return com.careerops.util.JsonExtractor.extract(raw, mapper);
    }

    /**
     * Raw text call — returns Claude's response as a plain string.
     */
    public String generate(String systemPrompt, String userPrompt, UUID userId, String featureName) {
        if (apiKey == null || apiKey.isBlank() || apiKey.startsWith("YOUR_")) {
            log.error("ClaudeDirectService: Anthropic API key not configured");
            // 3.074 — Throw exception instead of returning silent stub data
            throw com.careerops.exception.ApiException.internalError("AI engine not configured (Anthropic)");
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

        return callWithRetry(body, userId, featureName);
    }

    private String callWithRetry(ObjectNode body, UUID userId, String featureName) {
        Timer.Sample sample = Timer.start(meterRegistry);
        int maxAttempts = 3;
        long backoffMs = 2000;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String responseStr = restClient.post()
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .body(body.toString())
                    .retrieve()
                    .body(String.class);

                JsonNode resp = mapper.readTree(responseStr);
                
                // 3.075 — Record token usage
                JsonNode usage = resp.path("usage");
                if (!usage.isMissingNode()) {
                    int input  = usage.path("input_tokens").asInt(0);
                    int output = usage.path("output_tokens").asInt(0);
                    // Approximate cost for Opus: $15/M input, $75/M output (simplified for proxy)
                    double cost = (input * 0.000015) + (output * 0.000075);
                    tokenUsageService.record(userId, featureName, model, input, output, cost);
                }

                StringBuilder sb = new StringBuilder();
                for (JsonNode block : resp.path("content")) {
                    if ("text".equals(block.path("type").asText())) {
                        sb.append(block.path("text").asText());
                    }
                }
                String result = sb.toString().trim();
                sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_direct", "status", "success"));
                return result;
            } catch (RestClientResponseException e) {
                int status = e.getStatusCode().value();
                if (status == 401) {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_direct", "status", "failure"));
                    return mapper.createObjectNode().put("error", "Invalid Anthropic API key").toString();
                }
                if (status == 429 || status == 529) {
                    if (attempt == maxAttempts) {
                        sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_direct", "status", "failure"));
                        String retryAfter = e.getResponseHeaders() != null ? e.getResponseHeaders().getFirst(org.springframework.http.HttpHeaders.RETRY_AFTER) : null;
                        Integer seconds = null;
                        if (retryAfter != null) {
                            try { seconds = Integer.parseInt(retryAfter); } catch (Exception ignored) {}
                        }
                        throw com.careerops.exception.ApiException.tooManyRequests(
                            "AI engine is currently overloaded. Please try again later.", seconds);
                    }
                    log.warn("ClaudeDirectService: rate limited, retrying... (attempt {})", attempt);
                    try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    backoffMs *= 2;
                } else {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_direct", "status", "failure"));
                    throw new com.careerops.exception.ApiException(
                        org.springframework.http.HttpStatus.valueOf(status), "Claude API error: " + status);
                }
            } catch (Exception e) {
                if (attempt == maxAttempts) {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_direct", "status", "failure"));
                    throw com.careerops.exception.ApiException.internalError("Max retries exceeded: " + e.getMessage());
                }
                log.warn("ClaudeDirectService: call failed, retrying... (attempt {})", attempt);
                try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                backoffMs *= 2;
            }
        }
        throw com.careerops.exception.ApiException.internalError("Max retries exceeded");
    }

    // 3.072 — stripCodeFences logic removed in favour of JsonExtractor.extract()
}
