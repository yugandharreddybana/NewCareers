package com.careerops.service;

import com.careerops.model.AgentResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.*;

/**
 * Agentic loop service backed by NVIDIA NIM (OpenAI tool_calls format).
 *
 * Drop-in replacement for ClaudeAgentService. Preserves the same public API:
 *   AgentResult run(String systemPrompt, ArrayNode messages, UUID userId, UUID userJobId)
 *
 * Tool-calling differences vs Anthropic:
 *   Anthropic stop_reason = "tool_use"   → NVIDIA finish_reason = "tool_calls"
 *   Anthropic block type  = "tool_use"   → NVIDIA choices[0].message.tool_calls[]
 *   Anthropic tool result = role:user, type:tool_result, tool_use_id
 *                         → NVIDIA role:"tool", tool_call_id, content
 *
 * All other logic (deadline, per-tool timeout, ask_user, end_turn) is identical to
 * ClaudeAgentService.
 */
@Service
public class NvidiaAgentService {

    private static final Logger log = LoggerFactory.getLogger(NvidiaAgentService.class);
    private static final String BASE_URL = "https://integrate.api.nvidia.com/v1";

    @Value("${nvidia.api.key:}")
    private String apiKey;

    @Value("${nvidia.agent.model:meta/llama-3.1-405b-instruct}")
    private String model;

    @Value("${nvidia.max.tokens:8192}")
    private int maxTokens;

    @Value("${anthropic.max.tool.iterations:25}")
    private int maxIterations;

    private final RestClient         restClient;
    private final SkillToolDispatcher dispatcher;
    private final ObjectMapper        mapper;
    private final JsonNode            toolDefinitions;
    private final io.github.resilience4j.circuitbreaker.CircuitBreaker circuitBreaker;
    private final ExecutorService     toolExecutor;
    private final TokenUsageService   tokenUsageService;
    private final UserConsentService  consentService;
    private final MeterRegistry       meterRegistry;

    public NvidiaAgentService(SkillToolDispatcher dispatcher,
                              ObjectMapper mapper,
                              CircuitBreakerRegistry circuitBreakerRegistry,
                              TokenUsageService tokenUsageService,
                              UserConsentService consentService,
                              MeterRegistry meterRegistry) {
        this.dispatcher        = dispatcher;
        this.mapper            = mapper;
        this.tokenUsageService = tokenUsageService;
        this.consentService    = consentService;
        this.meterRegistry     = meterRegistry;

        this.toolExecutor = Executors.newFixedThreadPool(10, r -> {
            Thread t = new Thread(r);
            t.setName("nvidia-tool-exec-" + t.threadId());
            t.setDaemon(true);
            return t;
        });

        this.circuitBreaker = circuitBreakerRegistry.circuitBreaker("nvidia-agent",
            io.github.resilience4j.circuitbreaker.CircuitBreakerConfig.custom()
                .slidingWindowSize(20)
                .failureRateThreshold(50.0f)
                .waitDurationInOpenState(Duration.ofSeconds(30))
                .permittedNumberOfCallsInHalfOpenState(3)
                .recordExceptions(RestClientResponseException.class, TimeoutException.class)
                .ignoreExceptions(com.careerops.exception.ApiException.class)
                .build());

        this.restClient = RestClient.builder()
            .baseUrl(BASE_URL)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();

        this.toolDefinitions = buildToolDefinitions();
    }

    @PreDestroy
    public void shutdown() {
        toolExecutor.shutdown();
    }

    // ─── Public agentic loop ─────────────────────────────────────────────────

    public AgentResult run(String systemPrompt, ArrayNode messages, UUID userId, UUID userJobId) {
        consentService.validateAiConsent(userId);
        long deadline   = System.currentTimeMillis() + (120 * 1000);
        int  iterations = 0;

        while (iterations < maxIterations) {
            if (System.currentTimeMillis() > deadline) {
                log.warn("NvidiaAgentService: deadline exceeded for userId={}", userId);
                return AgentResult.error("The AI process took too long and was aborted. Please try again.");
            }
            iterations++;
            log.debug("NvidiaAgentService iteration {}/{} for userId={}", iterations, maxIterations, userId);

            ObjectNode body = buildRequestBody(systemPrompt, messages);
            JsonNode   response = callWithRetry(body, userId, "Skill Run");
            if (response == null) {
                return AgentResult.error("AI engine is temporarily unavailable. Please try again.");
            }

            JsonNode choice     = response.path("choices").path(0);
            String   stopReason = choice.path("finish_reason").asText("");
            JsonNode message    = choice.path("message");

            // ── End of turn ──────────────────────────────────────────────────
            if ("stop".equals(stopReason)) {
                String text = message.path("content").asText("").trim();
                if (text.isEmpty()) {
                    return AgentResult.error("The AI finished but returned no content. Please try again.");
                }
                return AgentResult.done(text);
            }

            // ── Tool calls ───────────────────────────────────────────────────
            if ("tool_calls".equals(stopReason)) {
                // Append assistant message to history (OpenAI format)
                ObjectNode assistantMsg = mapper.createObjectNode();
                assistantMsg.put("role", "assistant");
                assistantMsg.set("content", message.path("content"));
                assistantMsg.set("tool_calls", message.path("tool_calls"));
                ((ArrayNode) messages).add(assistantMsg);

                for (JsonNode toolCall : message.path("tool_calls")) {
                    String toolCallId = toolCall.path("id").asText();
                    String toolName   = toolCall.path("function").path("name").asText();
                    String argsRaw    = toolCall.path("function").path("arguments").asText("{}");

                    JsonNode toolInput;
                    try {
                        toolInput = mapper.readTree(argsRaw);
                    } catch (JsonProcessingException e) {
                        toolInput = mapper.createObjectNode();
                    }

                    log.debug("NvidiaAgentService calling tool: {} (id={})", toolName, toolCallId);

                    // ask_user causes immediate pause
                    if ("ask_user".equals(toolName)) {
                        String question = toolInput.path("question").asText("I need more information to continue.");
                        return AgentResult.needsAnswer(question, messages, toolCallId);
                    }

                    // Dispatch with per-tool timeout
                    String toolResult;
                    if (System.currentTimeMillis() > deadline) {
                        toolResult = "Tool execution aborted: global deadline reached.";
                    } else {
                        try {
                            final JsonNode finalToolInput = toolInput;
                            toolResult = CompletableFuture.supplyAsync(
                                () -> dispatcher.dispatch(toolName, finalToolInput, userId, userJobId),
                                toolExecutor
                            ).get(30, TimeUnit.SECONDS);
                        } catch (TimeoutException te) {
                            log.warn("Tool call timed out: {} (id={})", toolName, toolCallId);
                            toolResult = "Tool execution timed out after 30 seconds.";
                        } catch (Exception e) {
                            log.error("Tool execution error: {} (id={})", toolName, toolCallId, e);
                            toolResult = "Tool execution failed: " + e.getMessage();
                        }
                    }

                    // Append tool result in OpenAI format: role=tool
                    ObjectNode toolResultMsg = mapper.createObjectNode();
                    toolResultMsg.put("role", "tool");
                    toolResultMsg.put("tool_call_id", toolCallId);
                    toolResultMsg.put("content", toolResult);
                    ((ArrayNode) messages).add(toolResultMsg);
                }
                continue;
            }

            log.warn("NvidiaAgentService: unexpected finish_reason={}", stopReason);
            return AgentResult.error("Unexpected response from AI engine. Please try again.");
        }

        log.warn("NvidiaAgentService: max iterations ({}) exceeded for userId={}", maxIterations, userId);
        return AgentResult.error("This skill is taking longer than expected. Please try again.");
    }

    // ─── Request builder ─────────────────────────────────────────────────────

    private ObjectNode buildRequestBody(String systemPrompt, ArrayNode messages) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", maxTokens);

        // Prepend system message
        ArrayNode fullMessages = mapper.createArrayNode();
        fullMessages.addObject().put("role", "system").put("content", systemPrompt);
        fullMessages.addAll(messages);
        body.set("messages", fullMessages);

        // OpenAI tool definitions format
        body.set("tools", toolDefinitions);
        body.put("tool_choice", "auto");
        return body;
    }

    // ─── HTTP call with circuit breaker + retry ───────────────────────────────

    private JsonNode callWithRetry(ObjectNode body, UUID userId, String feature) {
        Timer.Sample sample     = Timer.start(meterRegistry);
        int          maxAttempts = 3;
        long         backoffMs   = 2000;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                JsonNode result = circuitBreaker.executeSupplier(() -> {
                    String raw = restClient.post()
                        .uri("/chat/completions")
                        .header("Authorization", "Bearer " + apiKey)
                        .body(body.toString())
                        .retrieve()
                        .body(String.class);
                    try {
                        JsonNode resp = mapper.readTree(raw);
                        JsonNode usage = resp.path("usage");
                        if (!usage.isMissingNode()) {
                            int    input  = usage.path("prompt_tokens").asInt(0);
                            int    output = usage.path("completion_tokens").asInt(0);
                            double cost   = (input + output) * 0.0000002;
                            tokenUsageService.record(userId, feature, model, input, output, cost);
                        }
                        return resp;
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to parse NVIDIA response", e);
                    }
                });
                sample.stop(meterRegistry.timer("outbound.call.latency", "service", "nvidia_agent", "status", "success"));
                return result;

            } catch (io.github.resilience4j.circuitbreaker.CallNotPermittedException e) {
                sample.stop(meterRegistry.timer("outbound.call.latency", "service", "nvidia_agent", "status", "failure"));
                log.error("NVIDIA circuit breaker OPEN — fast-failing.");
                throw com.careerops.exception.ApiException.internalError("AI engine currently unavailable (circuit breaker open).");

            } catch (RestClientResponseException ex) {
                int status = ex.getStatusCode().value();
                if (status == 401) {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "nvidia_agent", "status", "failure"));
                    log.error("NVIDIA API key invalid (401)");
                    return mapper.createObjectNode();
                }
                if ((status == 429) && attempt < maxAttempts) {
                    log.warn("NVIDIA rate limited, retrying (attempt {})", attempt);
                } else if (attempt == maxAttempts) {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "nvidia_agent", "status", "failure"));
                    throw com.careerops.exception.ApiException.internalError("AI engine error (status " + status + ")");
                }
                try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                backoffMs *= 2;

            } catch (Exception e) {
                if (attempt == maxAttempts) {
                    sample.stop(meterRegistry.timer("outbound.call.latency", "service", "nvidia_agent", "status", "failure"));
                    throw com.careerops.exception.ApiException.internalError("AI processing failed: " + e.getMessage());
                }
                log.warn("NVIDIA agent call failed, retrying (attempt {}): {}", attempt, e.getMessage());
                try { Thread.sleep(backoffMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                backoffMs *= 2;
            }
        }
        throw com.careerops.exception.ApiException.internalError("Max retries exceeded");
    }

    // ─── Tool definitions (OpenAI function-calling format) ────────────────────

    private JsonNode buildToolDefinitions() {
        try {
            String json = """
            [
              {
                "type": "function",
                "function": {
                  "name": "read_profile",
                  "description": "Read the authenticated user's career profile including target roles, tech stack, salary expectations, location, work authorization, and all other profile fields. Returns YAML-formatted profile data.",
                  "parameters": { "type": "object", "properties": {}, "required": [] }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "read_resume",
                  "description": "Read the user's uploaded CV/resume as plain text.",
                  "parameters": { "type": "object", "properties": {}, "required": [] }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "read_job",
                  "description": "Read the full details of the current job posting.",
                  "parameters": { "type": "object", "properties": {}, "required": [] }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "read_evaluation",
                  "description": "Read the most recent saved evaluation for the current job.",
                  "parameters": { "type": "object", "properties": {}, "required": [] }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "read_research",
                  "description": "Read the most recent saved company research for the current job.",
                  "parameters": { "type": "object", "properties": {}, "required": [] }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "web_fetch",
                  "description": "Fetch the content of a public URL and return it as plain text.",
                  "parameters": {
                    "type": "object",
                    "properties": {
                      "url": { "type": "string", "description": "The full URL to fetch (must start with https:// or http://)" }
                    },
                    "required": ["url"]
                  }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "web_search",
                  "description": "Search the web for current information.",
                  "parameters": {
                    "type": "object",
                    "properties": {
                      "query": { "type": "string", "description": "Search query string" }
                    },
                    "required": ["query"]
                  }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "ask_user",
                  "description": "Ask the user a clarifying question when you need information not available in their profile.",
                  "parameters": {
                    "type": "object",
                    "properties": {
                      "question": { "type": "string", "description": "The specific question to ask the user." }
                    },
                    "required": ["question"]
                  }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "save_resume_html",
                  "description": "Save the generated ATS-optimised resume HTML to the user's account.",
                  "parameters": {
                    "type": "object",
                    "properties": {
                      "html": { "type": "string", "description": "Complete HTML content of the tailored resume" },
                      "filename": { "type": "string", "description": "Filename slug e.g. google-swe-2026.html" }
                    },
                    "required": ["html", "filename"]
                  }
                }
              },
              {
                "type": "function",
                "function": {
                  "name": "update_application_status",
                  "description": "Update the user's application status for the current job.",
                  "parameters": {
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
              }
            ]
            """;
            return mapper.readTree(json);
        } catch (Exception e) {
            log.error("Failed to parse NVIDIA tool definitions", e);
            return mapper.createArrayNode();
        }
    }
}
