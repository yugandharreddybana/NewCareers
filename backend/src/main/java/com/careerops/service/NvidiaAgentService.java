package com.careerops.service;

import com.careerops.model.AgentResult;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
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
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;

/**
 * Agentic loop service backed by NVIDIA NIM (OpenAI tool_calls format).
 *
 * This is the ACTIVE AI provider. ClaudeAgentService is maintained as a ready
 * drop-in for future migration back to Anthropic — both services share identical
 * public API, tool definitions, and agentic loop semantics.
 *
 * Tool-calling differences vs Anthropic:
 *   Anthropic stop_reason = "tool_use"   → NVIDIA finish_reason = "tool_calls"
 *   Anthropic block type  = "tool_use"   → NVIDIA choices[0].message.tool_calls[]
 *   Anthropic tool result = role:user, type:tool_result, tool_use_id
 *                         → NVIDIA role:"tool", tool_call_id, content
 *
 * All other logic (deadline, per-tool timeout, ask_user, end_turn) is identical to
 * ClaudeAgentService.
 *
 * FIX: Raised agent deadline from 120s → configurable (default 160s) to give
 * multi-step skills (tailor-resume, research, compare) enough time to complete
 * all tool calls + final generation without hitting a premature abort.
 * FIX: Added explicit connect/read timeouts on the RestClient (150s read) so that
 * a hung NVIDIA response cannot block a Tomcat thread indefinitely.
 * FIX: Reduced initial retry backoff from 2000ms → 1000ms for faster recovery on
 * transient failures.
 */
@Service
public class NvidiaAgentService {

    private static final Logger log = LoggerFactory.getLogger(NvidiaAgentService.class);
    private static final String BASE_URL = "https://integrate.api.nvidia.com/v1";

    private static final Map<String, Integer> SKILL_MAX_TOKENS = Map.of(
        "tailor-resume",   5000,
        "cover-letter",    1800,
        "evaluate",        1200,
        "research",        2500,
        "prep-interview",  2500,
        "compare",         1500
    );
    private static final Map<String, Integer> SKILL_MAX_ITERATIONS = Map.of(
        "tailor-resume",   8,
        "cover-letter",    4,
        "evaluate",        5,
        "research",        7,
        "prep-interview",  6,
        "compare",         5
    );
    private static final Map<String, String> SKILL_MODEL_OVERRIDE = Map.of(
        "evaluate",      "meta/llama-3.1-8b-instruct",
        "cover-letter",  "meta/llama-3.1-8b-instruct"
    );
    private static final Map<String, Set<String>> SKILL_TOOLS = Map.of(
        "tailor-resume",   Set.of("ask_user", "save_resume_html"),
        "cover-letter",    Set.of("ask_user"),
        "evaluate",        Set.of("ask_user"),
        "research",        Set.of("web_search", "web_fetch", "ask_user"),
        "prep-interview",  Set.of("web_search", "ask_user"),
        "compare",         Set.of("read_evaluation", "ask_user")
    );
    private static final Set<String> DEFAULT_TOOLS = Set.of(
        "web_search", "web_fetch", "ask_user"
    );

    @Value("${nvidia.api.key:}")
    private String apiKey;

    @Value("${nvidia.agent.model:meta/llama-3.3-70b-instruct}")
    private String model;

    @Value("${nvidia.fallback.model:meta/llama-3.1-70b-instruct}")
    private String fallbackModel;

    // legacy property; per-skill maps take precedence in run()
    @Value("${nvidia.max.tokens:8192}")
    private int maxTokens;

    // legacy property; per-skill maps take precedence in run()
    @Value("${anthropic.max.tool.iterations:25}")
    private int maxIterations;

    /**
     * Per-agent-run deadline in seconds. Raised to 160s (was hardcoded 120s) to give
     * multi-step skills enough room to complete all tool calls plus final generation.
     * Override with nvidia.agent.deadline.seconds in application.properties.
     */
    @Value("${nvidia.agent.deadline.seconds:160}")
    private int agentDeadlineSeconds;

    private final RestClient         restClient;
    private final SkillToolDispatcher dispatcher;
    private final ObjectMapper        mapper;
    private final JsonNode            allToolDefinitions;
    private final io.github.resilience4j.circuitbreaker.CircuitBreaker circuitBreaker;
    private final ExecutorService     toolExecutor;
    private final TokenUsageService   tokenUsageService;
    private final UserConsentService  consentService;
    private final UserProfileRepository profileRepository;
    private final CvService cvService;
    private final JobRepository jobRepository;
    private final UserJobRepository userJobRepository;
    private final MeterRegistry       meterRegistry;

    public NvidiaAgentService(SkillToolDispatcher dispatcher,
                              ObjectMapper mapper,
                              CircuitBreakerRegistry circuitBreakerRegistry,
                              TokenUsageService tokenUsageService,
                              UserConsentService consentService,
                              UserProfileRepository profileRepository,
                              CvService cvService,
                              JobRepository jobRepository,
                              UserJobRepository userJobRepository,
                              MeterRegistry meterRegistry) {
        this.dispatcher        = dispatcher;
        this.mapper            = mapper;
        this.tokenUsageService = tokenUsageService;
        this.consentService    = consentService;
        this.profileRepository  = profileRepository;
        this.cvService          = cvService;
        this.jobRepository      = jobRepository;
        this.userJobRepository  = userJobRepository;
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

        // Explicit timeouts on the RestClient: connect 10s, read 150s.
        // Without these, a hung NVIDIA response blocks Tomcat threads indefinitely.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(150_000);
        this.restClient = RestClient.builder()
            .baseUrl(BASE_URL)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .requestFactory(factory)
            .build();

        this.allToolDefinitions = buildAllToolDefinitions();
    }

    @PreDestroy
    public void shutdown() {
        toolExecutor.shutdown();
    }

    // ─── Public agentic loop ─────────────────────────────────────────────────

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    static String normalizeSkillName(String skillName) {
        return (skillName == null || skillName.isBlank()) ? null : skillName.trim();
    }

    static int resolveMaxTokens(String skillName, int configuredDefault) {
        String key = normalizeSkillName(skillName);
        return key == null ? 4096 : SKILL_MAX_TOKENS.getOrDefault(key, 4096);
    }

    static int resolveMaxIterations(String skillName, int configuredDefault) {
        String key = normalizeSkillName(skillName);
        return key == null ? 10 : SKILL_MAX_ITERATIONS.getOrDefault(key, 10);
    }

    static String resolveModel(String skillName, String defaultModel) {
        String key = normalizeSkillName(skillName);
        return key == null ? defaultModel : SKILL_MODEL_OVERRIDE.getOrDefault(key, defaultModel);
    }

    static Set<String> resolveAllowedTools(String skillName) {
        String key = normalizeSkillName(skillName);
        if (key == null) {
            return DEFAULT_TOOLS;
        }
        return SKILL_TOOLS.getOrDefault(key, DEFAULT_TOOLS);
    }

    public AgentResult run(String systemPrompt, ArrayNode messages, UUID userId, UUID userJobId, String skillName) {
        consentService.validateAiConsent(userId);
        String enrichedSystemPrompt = buildEnrichedSystemPrompt(systemPrompt, userId, userJobId);
        int effectiveMaxTokens     = resolveMaxTokens(skillName, maxTokens);
        int effectiveMaxIterations = resolveMaxIterations(skillName, maxIterations);
        String effectiveModel      = resolveModel(skillName, model);

        log.debug("NvidiaAgentService skill={} maxTokens={} maxIterations={} model={} allowedTools={}",
            skillName, effectiveMaxTokens, effectiveMaxIterations, effectiveModel, resolveAllowedTools(skillName));

        if (!isConfigured()) {
            return AgentResult.error("AI engine not configured. Set NVIDIA_API_KEY in your environment.");
        }
        long deadline   = System.currentTimeMillis() + ((long) agentDeadlineSeconds * 1000);
        int  iterations = 0;

        while (iterations < effectiveMaxIterations) {
            if (System.currentTimeMillis() > deadline) {
                log.warn("NvidiaAgentService: deadline exceeded for userId={}", userId);
                return AgentResult.error("The AI process took too long and was aborted. Please try again.");
            }
            iterations++;
            log.debug("NvidiaAgentService iteration {}/{} for userId={}", iterations, effectiveMaxIterations, userId);

            ObjectNode body = buildRequestBody(
                enrichedSystemPrompt, messages, effectiveMaxTokens, effectiveModel, skillName);
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

                    if ("ask_user".equals(toolName)) {
                        String question = toolInput.path("question").asText("I need more information to continue.");
                        return AgentResult.needsAnswer(question, messages, toolCallId);
                    }

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

        log.warn("NvidiaAgentService: max iterations ({}) exceeded for userId={}", effectiveMaxIterations, userId);
        return AgentResult.error("This skill is taking longer than expected. Please try again.");
    }

    // ─── Request builder ─────────────────────────────────────────────────────

    private String buildEnrichedSystemPrompt(String baseSystemPrompt, UUID userId, UUID userJobId) {
        StringBuilder enriched = new StringBuilder(baseSystemPrompt);
        enriched.append("\n\n=== PRE-LOADED CONTEXT (do NOT call read_profile, read_resume, or read_job — data is already here) ===\n");
        try {
            profileRepository.findByUserId(userId).ifPresent(p -> {
                enriched.append("\n--- USER PROFILE ---\n");
                if (p.getTargetRoles() != null) enriched.append("target_roles: ").append(Arrays.toString(p.getTargetRoles())).append("\n");
                if (p.getTechStack() != null) enriched.append("tech_stack: ").append(Arrays.toString(p.getTechStack())).append("\n");
                if (p.getLocation() != null) enriched.append("location: ").append(p.getLocation()).append("\n");
                if (p.getSalaryMin() != null) enriched.append("salary_min: ").append(p.getSalaryMin()).append("\n");
                if (p.getSalaryMax() != null) enriched.append("salary_max: ").append(p.getSalaryMax()).append("\n");
                if (p.getExperienceLevel() != null) enriched.append("experience_level: ").append(p.getExperienceLevel()).append("\n");
                if (p.getSponsorshipRequired() != null) enriched.append("sponsorship_required: ").append(p.getSponsorshipRequired()).append("\n");
            });
        } catch (Exception e) { log.warn("Could not pre-load profile for userId={}", userId); }
        try {
            String cv = cvService.activeCvText(userId);
            if (cv != null && !cv.isBlank()) {
                String truncatedCv = cv.length() > 6000 ? cv.substring(0, 6000) + "\n...[CV truncated]" : cv;
                enriched.append("\n--- USER CV/RESUME ---\n").append(truncatedCv).append("\n");
            }
        } catch (Exception e) { log.warn("Could not pre-load CV for userId={}", userId); }
        try {
            if (userJobId != null) {
                userJobRepository.findByIdAndUserId(userJobId, userId).ifPresent(uj ->
                    jobRepository.findById(uj.getJobId()).ifPresent(j -> {
                        enriched.append("\n--- JOB POSTING ---\n");
                        enriched.append("title: ").append(j.getTitle()).append("\n");
                        enriched.append("company: ").append(j.getCompany()).append("\n");
                        enriched.append("location: ").append(j.getLocation()).append("\n");
                        String desc = j.getDescription() != null ? j.getDescription() : "";
                        String truncDesc = desc.length() > 3000 ? desc.substring(0, 3000) + "\n...[truncated]" : desc;
                        enriched.append("description:\n").append(truncDesc).append("\n");
                    })
                );
            }
        } catch (Exception e) { log.warn("Could not pre-load job for userJobId={}", userJobId); }
        return enriched.toString();
    }

    private ObjectNode buildRequestBody(
            String systemPrompt,
            ArrayNode messages,
            int effectiveMaxTokens,
            String effectiveModel,
            String skillName) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", effectiveModel);
        body.put("max_tokens", effectiveMaxTokens);

        ArrayNode fullMessages = mapper.createArrayNode();
        fullMessages.addObject().put("role", "system").put("content", systemPrompt);
        fullMessages.addAll(messages);
        body.set("messages", fullMessages);

        Set<String> allowedTools = resolveAllowedTools(skillName);
        body.set("tools", buildToolDefinitions(allowedTools));
        body.put("tool_choice", "auto");
        return body;
    }

    // ─── HTTP call with circuit breaker + retry ───────────────────────────────

    private JsonNode callWithRetry(ObjectNode body, UUID userId, String feature) {
        Timer.Sample sample     = Timer.start(meterRegistry);
        int          maxAttempts = 3;
        long         backoffMs   = 1000; // reduced from 2000 — faster first retry

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
                            String recordedModel = body.path("model").asText(model);
                            tokenUsageService.record(userId, feature, recordedModel, input, output, cost);
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
                    throw com.careerops.exception.ApiException.internalError("Invalid NVIDIA API key (401). Check your NVIDIA_API_KEY configuration.");
                }
                String requestModel = body.path("model").asText(model);
                if (status == 404 && attempt == 1 && !requestModel.equals(fallbackModel)) {
                    log.warn("NVIDIA model {} not found (404), retrying with fallback {}", requestModel, fallbackModel);
                    body.put("model", fallbackModel);
                    continue;
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

    private JsonNode buildToolDefinitions(Set<String> allowedTools) {
        ArrayNode filtered = mapper.createArrayNode();
        if (allToolDefinitions == null || !allToolDefinitions.isArray()) {
            return filtered;
        }
        for (JsonNode tool : allToolDefinitions) {
            String name = tool.path("function").path("name").asText("");
            if (allowedTools.contains(name)) {
                filtered.add(tool);
            }
        }
        return filtered;
    }

    private JsonNode buildAllToolDefinitions() {
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
