package com.careerops.service;

import com.careerops.model.AgentResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

import java.time.Duration;
import java.util.UUID;

/**
 * Core Claude agentic loop service.
 *
 * Implements the full tool-use cycle:
 * 1. Send system prompt + message history to Claude
 * 2. If Claude returns tool_use blocks, dispatch each tool via SkillToolDispatcher
 * 3. Append tool_result back into the message history
 * 4. Loop until Claude returns end_turn or max iterations exceeded
 * 5. If ask_user tool is called, immediately PAUSE and return NeedsAnswer
 *
 * NOTE: The system currently runs on the NVIDIA API (NvidiaAgentService).
 * This service is maintained as a ready drop-in for future migration back to Anthropic Claude.
 * All fixes applied here keep it production-ready for that migration.
 */
@Service
public class ClaudeAgentService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeAgentService.class);

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

    // BUG-3.001 FIX: Correct Anthropic API version header.
    // This is the API contract version (fixed at "2023-06-01"), NOT the model release date.
    // Sending any other value (e.g. "2024-10-22") causes a 400 Bad Request on every call.
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    @Value("${anthropic.api.key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-opus-4-5}")
    private String model;

    @Value("${anthropic.max.tokens:8192}")
    private int maxTokens;

    @Value("${anthropic.max.tool.iterations:25}")
    private int maxIterations;

    @Value("${anthropic.call.timeout.seconds:120}")
    private int timeoutSeconds;

    private final RestClient webClient;
    private final SkillToolDispatcher dispatcher;
    private final ObjectMapper mapper;
    private final JsonNode toolDefinitions;
    private final io.github.resilience4j.circuitbreaker.CircuitBreaker circuitBreaker;
    // BUG-3.002 FIX: Declared as field so @PreDestroy can shut it down cleanly.
    private final java.util.concurrent.ExecutorService toolExecutor;
    private final TokenUsageService tokenUsageService;
    private final UserConsentService consentService;
    private final MeterRegistry meterRegistry;

    public ClaudeAgentService(SkillToolDispatcher dispatcher,
                              ObjectMapper mapper,
                              CircuitBreakerRegistry circuitBreakerRegistry,
                              TokenUsageService tokenUsageService,
                              UserConsentService consentService,
                              MeterRegistry meterRegistry) {
        this.dispatcher = dispatcher;
        this.mapper = mapper;
        this.tokenUsageService = tokenUsageService;
        this.consentService = consentService;
        this.meterRegistry = meterRegistry;

        this.toolExecutor = java.util.concurrent.Executors.newFixedThreadPool(10, r -> {
            Thread t = new Thread(r);
            t.setName("tool-exec-" + t.threadId());
            t.setDaemon(true);
            return t;
        });

        this.circuitBreaker = circuitBreakerRegistry.circuitBreaker("anthropic",
            io.github.resilience4j.circuitbreaker.CircuitBreakerConfig.custom()
                .slidingWindowSize(20)
                .failureRateThreshold(50.0f)
                .waitDurationInOpenState(Duration.ofSeconds(30))
                .permittedNumberOfCallsInHalfOpenState(3)
                .recordExceptions(RestClientResponseException.class, java.util.concurrent.TimeoutException.class)
                .ignoreExceptions(com.careerops.exception.ApiException.class)
                .build());

        this.webClient = RestClient.builder()
            .baseUrl(ANTHROPIC_API_URL)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader("anthropic-beta", "prompt-caching-2024-07-31")
            .build();
        this.toolDefinitions = buildToolDefinitions();
    }

    // BUG-3.002 FIX: Shut down the dedicated tool executor on application stop.
    // Without this the 10-thread fixed pool leaks on every redeploy/restart.
    @PreDestroy
    public void shutdown() {
        toolExecutor.shutdown();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public AgentResult run(
            String systemPrompt,
            ArrayNode messages,
            UUID userId,
            UUID userJobId) {

        consentService.validateAiConsent(userId);
        long deadline = System.currentTimeMillis() + (120 * 1000);
        int iterations = 0;

        while (iterations < maxIterations) {
            long now = System.currentTimeMillis();
            if (now > deadline) {
                log.warn("Claude agent deadline exceeded (2m) for userId={}", userId);
                return AgentResult.error("The AI process took too long and was aborted. Please try again.");
            }
            iterations++;
            log.debug("Claude iteration {}/{} for userId={}", iterations, maxIterations, userId);

            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            body.put("max_tokens", maxTokens);

            ArrayNode systemArr = mapper.createArrayNode();
            ObjectNode systemBlock = mapper.createObjectNode();
            systemBlock.put("type", "text");
            systemBlock.put("text", systemPrompt);
            systemBlock.set("cache_control", mapper.createObjectNode().put("type", "ephemeral"));
            systemArr.add(systemBlock);
            body.set("system", systemArr);

            body.set("messages", messages);
            body.set("tools", toolDefinitions);

            JsonNode response = callWithRetry(body, userId, "Skill Run");
            if (response == null) {
                return AgentResult.error("Claude API is temporarily unavailable. Please try again.");
            }

            String stopReason = response.path("stop_reason").asText();

            if ("end_turn".equals(stopReason)) {
                String text = extractTextContent(response);
                if (text.isEmpty()) {
                    return AgentResult.error("The AI finished its work but did not generate a final report. Please try resuming or starting again.");
                }
                return AgentResult.done(text);
            }

            if ("tool_use".equals(stopReason)) {
                ObjectNode assistantMsg = mapper.createObjectNode();
                assistantMsg.put("role", "assistant");
                assistantMsg.set("content", response.path("content"));
                ((ArrayNode) messages).add(assistantMsg);

                ArrayNode toolResults = mapper.createArrayNode();
                for (JsonNode block : response.path("content")) {
                    if (!"tool_use".equals(block.path("type").asText())) continue;

                    String toolName = block.path("name").asText();
                    String toolUseId = block.path("id").asText();
                    JsonNode toolInput = block.path("input");

                    log.debug("Claude calling tool: {} (id={})", toolName, toolUseId);

                    if ("ask_user".equals(toolName)) {
                        String question = toolInput.path("question").asText(
                            "I need a bit more information to continue.");
                        return AgentResult.needsAnswer(question, messages, toolUseId);
                    }

                    String result;
                    if (System.currentTimeMillis() > deadline) {
                        log.warn("Claude agent deadline reached during tool loop for userId={}", userId);
                        result = "Tool execution aborted: Global process deadline reached.";
                    } else {
                        try {
                            result = java.util.concurrent.CompletableFuture.supplyAsync(
                                () -> dispatcher.dispatch(toolName, toolInput, userId, userJobId),
                                toolExecutor
                            ).get(30, java.util.concurrent.TimeUnit.SECONDS);
                        } catch (java.util.concurrent.TimeoutException te) {
                            log.warn("Tool call timed out: {} (id={})", toolName, toolUseId);
                            result = "Tool execution timed out after 30 seconds. Please proceed with current information.";
                        } catch (Exception e) {
                            log.error("Tool execution error: {} (id={})", toolName, toolUseId, e);
                            result = "Tool execution failed: " + e.getMessage();
                        }
                    }

                    ObjectNode toolResult = mapper.createObjectNode();
                    toolResult.put("type", "tool_result");
                    toolResult.put("tool_use_id", toolUseId);
                    toolResult.put("content", result);
                    toolResults.add(toolResult);
                }

                if (!toolResults.isEmpty()) {
                    ObjectNode userMsg = mapper.createObjectNode();
                    userMsg.put("role", "user");
                    userMsg.set("content", toolResults);
                    ((ArrayNode) messages).add(userMsg);
                }
                continue;
            }

            log.warn("Unexpected Claude stop_reason: {}", stopReason);
            return AgentResult.error("Unexpected response from AI engine. Please try again.");
        }

        log.warn("Claude max iterations ({}) exceeded for userId={}", maxIterations, userId);
        return AgentResult.error("This skill is taking longer than expected. Please try again.");
    }

    private JsonNode callWithRetry(ObjectNode body, UUID userId, String feature) {
        Timer.Sample sample = Timer.start(meterRegistry);
        int maxAttempts = 3;
        long backoffMs = 2000;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                JsonNode result = circuitBreaker.executeSupplier(() -> {
                    String s = webClient.post()
                        .header("x-api-key", apiKey)
                        .header("anthropic-version", ANTHROPIC_VERSION)
                        .body(body.toString())
                        .retrieve()
                        .body(String.class);

                    try {
                        JsonNode resp = mapper.readTree(s);
                        JsonNode usage = resp.path("usage");
                        if (!usage.isMissingNode()) {
                            int input  = usage.path("input_tokens").asInt(0);
                            int output = usage.path("output_tokens").asInt(0);
                            double cost = (input * 0.000015) + (output * 0.000075);
                            tokenUsageService.record(userId, feature, model, input, output, cost);
                        }
                        return resp;
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to parse Claude response", e);
                    }
                });
                sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_agent", "status", "success"));
                return result;
            } catch (io.github.resilience4j.circuitbreaker.CallNotPermittedException e) {
                sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_agent", "status", "failure"));
                log.error("Claude API circuit breaker is OPEN. Fast-failing request.");
                throw com.careerops.exception.ApiException.internalError("AI engine is currently unavailable (circuit breaker open).");
            } catch (RestClientResponseException ex) {
                int status = ex.getStatusCode().value();
                // BUG-3.003 FIX: Throw a clear ApiException on 401 instead of returning an empty
                // ObjectNode. The old code returned mapper.createObjectNode() which passed the
                // null-check in run(), fell through to stopReason="", and produced a misleading
                // "Unexpected stop_reason" error rather than "Invalid API key".
                if (status == 401) {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_agent", "status", "failure"));
                    log.error("Anthropic API key is invalid (401).");
                    throw com.careerops.exception.ApiException.internalError("Invalid Anthropic API key (401). Check your ANTHROPIC_API_KEY configuration.");
                }
                if (status == 429 || status == 529) {
                    if (attempt == maxAttempts) {
                        sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_agent", "status", "failure"));
                        log.error("Claude API error {}: body truncated for security", status);
                        throw new com.careerops.exception.ApiException(org.springframework.http.HttpStatus.valueOf(status), "AI engine error (status " + status + ")");
                    }
                    log.warn("Claude rate limited, retrying (attempt {})", attempt);
                    try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                    backoffMs *= 2;
                } else {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_agent", "status", "failure"));
                    log.error("Claude API error {}: body truncated for security", status);
                    throw new com.careerops.exception.ApiException(org.springframework.http.HttpStatus.valueOf(status), "AI engine error (status " + status + ")");
                }
            } catch (Exception e) {
                if (attempt == maxAttempts) {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "anthropic_agent", "status", "failure"));
                    if (e.getCause() instanceof java.util.concurrent.TimeoutException || e instanceof java.util.concurrent.TimeoutException) {
                        throw com.careerops.exception.ApiException.internalError("AI engine timed out. Please try again.");
                    }
                    log.error("Claude API call failed: {}", e.getMessage());
                    throw com.careerops.exception.ApiException.internalError("AI processing failed: " + e.getMessage());
                }
                log.warn("Claude call failed, retrying (attempt {})", attempt);
                try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                backoffMs *= 2;
            }
        }
        throw com.careerops.exception.ApiException.internalError("Max retries exceeded");
    }

    private String extractTextContent(JsonNode response) {
        StringBuilder sb = new StringBuilder();
        for (JsonNode block : response.path("content")) {
            if ("text".equals(block.path("type").asText())) {
                sb.append(block.path("text").asText());
            }
        }
        return sb.toString().trim();
    }

    private JsonNode buildToolDefinitions() {
        try {
            String json = """
            [
              {
                "name": "read_profile",
                "description": "Read the authenticated user's career profile including target roles, tech stack, salary expectations, location, work authorization, and all other profile fields. Returns YAML-formatted profile data.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "read_resume",
                "description": "Read the user's uploaded CV/resume as plain text.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "read_job",
                "description": "Read the full details of the current job posting.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "read_evaluation",
                "description": "Read the most recent saved evaluation for the current job.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "read_research",
                "description": "Read the most recent saved company research for the current job.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "web_fetch",
                "description": "Fetch the content of a public URL and return it as plain text.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "url": { "type": "string", "description": "The full URL to fetch (must start with https:// or http://)" }
                  },
                  "required": ["url"]
                }
              },
              {
                "name": "web_search",
                "description": "Search the web for current information.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "query": { "type": "string", "description": "Search query string" }
                  },
                  "required": ["query"]
                }
              },
              {
                "name": "ask_user",
                "description": "Ask the user a clarifying question when you need information not in their profile.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "question": { "type": "string", "description": "The specific question to ask the user." }
                  },
                  "required": ["question"]
                }
              },
              {
                "name": "save_resume_html",
                "description": "Save the generated ATS-optimised resume HTML to the user's account.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "html": { "type": "string", "description": "Complete HTML content of the tailored resume" },
                    "filename": { "type": "string", "description": "Filename slug e.g. google-swe-2026.html" }
                  },
                  "required": ["html", "filename"]
                }
              },
              {
                "name": "update_application_status",
                "description": "Update the user's application status for the current job.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "enum": ["New","Saved","Applied","Interview","Offer","Rejected","Withdrawn"]
                    }
                  },
                  "required": ["status"]
                }
              }
            ]
            """;
            return mapper.readTree(json);
        } catch (Exception e) {
            log.error("Failed to parse tool definitions", e);
            return mapper.createArrayNode();
        }
    }
}
