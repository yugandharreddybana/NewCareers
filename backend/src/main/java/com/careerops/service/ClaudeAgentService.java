package com.careerops.service;

import com.careerops.model.AgentResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
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
import java.util.List;
import java.util.UUID;

/**
 * Core Claude agentic loop service.
 *
 * Implements the full tool-use cycle:
 *   1. Send system prompt + message history to Claude
 *   2. If Claude returns tool_use blocks, dispatch each tool via SkillToolDispatcher
 *   3. Append tool_result back into the message history
 *   4. Loop until Claude returns end_turn or max iterations exceeded
 *   5. If ask_user tool is called, immediately PAUSE and return NeedsAnswer
 *
 * Security: userId is always passed through to SkillToolDispatcher —
 * tools can ONLY access data belonging to the authenticated user.
 */
@Service
public class ClaudeAgentService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeAgentService.class);

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION  = "2023-06-01";

    @Value("${anthropic.api.key}")
    private String apiKey;

    @Value("${anthropic.model:claude-opus-4-5}")
    private String model;

    @Value("${anthropic.max.tokens:8192}")
    private int maxTokens;

    @Value("${anthropic.max.tool.iterations:25}")
    private int maxIterations;

    @Value("${anthropic.call.timeout.seconds:120}")
    private int timeoutSeconds;

    private final WebClient webClient;
    private final SkillToolDispatcher dispatcher;
    private final ObjectMapper mapper;

    public ClaudeAgentService(SkillToolDispatcher dispatcher, ObjectMapper mapper) {
        this.dispatcher = dispatcher;
        this.mapper     = mapper;
        this.webClient  = WebClient.builder()
                .baseUrl(ANTHROPIC_API_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(10 * 1024 * 1024)) // 10MB
                .build();
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    /**
     * Run a skill agentic loop.
     *
     * @param systemPrompt  Full SKILL.md + reference docs (from SkillPromptLibrary)
     * @param messages      Mutable list of Claude message nodes (role+content)
     *                      On first call: single user message with skill context.
     *                      On resume: full restored conversation history.
     * @param userId        Authenticated user — passed to all tool dispatches
     * @param userJobId     Job context (may be null for triage/compare)
     * @return AgentResult.Done | AgentResult.NeedsAnswer | AgentResult.Error
     */
    public AgentResult run(
            String systemPrompt,
            ArrayNode messages,
            UUID userId,
            UUID userJobId) {

        int iterations = 0;

        while (iterations < maxIterations) {
            iterations++;
            log.debug("Claude iteration {}/{} for userId={}", iterations, maxIterations, userId);

            // ── Build API request ─────────────────────────────────────────────────
            ObjectNode body = mapper.createObjectNode();
            body.put("model",      model);
            body.put("max_tokens", maxTokens);
            body.put("system",     systemPrompt);
            body.set("messages",   messages);
            body.set("tools",      buildToolDefinitions());

            // ── Call Claude ───────────────────────────────────────────────────
            JsonNode response = callWithRetry(body);
            if (response == null) {
                return AgentResult.error("Claude API is temporarily unavailable. Please try again.");
            }

            String stopReason = response.path("stop_reason").asText();

            // ── Claude is done ─────────────────────────────────────────────────
            if ("end_turn".equals(stopReason)) {
                String text = extractTextContent(response);
                return AgentResult.done(text);
            }

            // ── Claude wants to call tools ───────────────────────────────────────
            if ("tool_use".equals(stopReason)) {
                // Append Claude's response (with tool_use blocks) to history
                ObjectNode assistantMsg = mapper.createObjectNode();
                assistantMsg.put("role", "assistant");
                assistantMsg.set("content", response.path("content"));
                ((ArrayNode) messages).add(assistantMsg);

                // Process all tool calls in this response
                ArrayNode toolResults = mapper.createArrayNode();
                for (JsonNode block : response.path("content")) {
                    if (!"tool_use".equals(block.path("type").asText())) continue;

                    String toolName  = block.path("name").asText();
                    String toolUseId = block.path("id").asText();
                    JsonNode toolInput = block.path("input");

                    log.debug("Claude calling tool: {} (id={})", toolName, toolUseId);

                    // ★ PAUSE POINT: ask_user tool pauses the loop
                    if ("ask_user".equals(toolName)) {
                        String question = toolInput.path("question").asText(
                                "I need a bit more information to continue.");
                        return AgentResult.needsAnswer(question, messages, toolUseId);
                    }

                    // Execute all other tools
                    String result = dispatcher.dispatch(toolName, toolInput, userId, userJobId);

                    ObjectNode toolResult = mapper.createObjectNode();
                    toolResult.put("type",        "tool_result");
                    toolResult.put("tool_use_id", toolUseId);
                    toolResult.put("content",     result);
                    toolResults.add(toolResult);
                }

                // Append all tool results as a single user message
                if (!toolResults.isEmpty()) {
                    ObjectNode userMsg = mapper.createObjectNode();
                    userMsg.put("role", "user");
                    userMsg.set("content", toolResults);
                    ((ArrayNode) messages).add(userMsg);
                }
                continue; // Next iteration
            }

            // Unexpected stop reason
            log.warn("Unexpected Claude stop_reason: {}", stopReason);
            return AgentResult.error("Unexpected response from AI engine. Please try again.");
        }

        log.warn("Claude max iterations ({}) exceeded for userId={}, skill loop terminated",
                maxIterations, userId);
        return AgentResult.error(
                "This skill is taking longer than expected. Please try again.");
    }

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    /**
     * Calls Claude API with retry on 429 / 529.
     * Returns null on unrecoverable failure.
     */
    private JsonNode callWithRetry(ObjectNode body) {
        int attempts = 0;
        int maxAttempts = 3;
        long delayMs = 2000;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                String responseStr = webClient.post()
                        .header("x-api-key",         apiKey)
                        .header("anthropic-version",  ANTHROPIC_VERSION)
                        .bodyValue(body.toString())
                        .retrieve()
                        .bodyToMono(String.class)
                        .timeout(Duration.ofSeconds(timeoutSeconds))
                        .block();

                return mapper.readTree(responseStr);

            } catch (WebClientResponseException e) {
                int status = e.getStatusCode().value();

                if (status == 401) {
                    log.error("Anthropic API key is invalid (401). Check anthropic.api.key.");
                    return null;
                }

                if ((status == 429 || status == 529) && attempts < maxAttempts) {
                    log.warn("Claude rate limited ({}), retrying in {}ms (attempt {}/{})",
                            status, delayMs, attempts, maxAttempts);
                    try { Thread.sleep(delayMs); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return null;
                    }
                    delayMs *= 2; // exponential backoff
                    continue;
                }

                log.error("Claude API error {}: {}", status, e.getResponseBodyAsString());
                return null;

            } catch (Exception e) {
                log.error("Claude API call failed: {}", e.getMessage(), e);
                return null;
            }
        }
        return null;
    }

    /** Extract plain text from Claude's end_turn response content. */
    private String extractTextContent(JsonNode response) {
        StringBuilder sb = new StringBuilder();
        for (JsonNode block : response.path("content")) {
            if ("text".equals(block.path("type").asText())) {
                sb.append(block.path("text").asText());
            }
        }
        return sb.toString().trim();
    }

    /**
     * All 10 tools available to Claude during skill runs.
     * Definitions match the Anthropic tool-use schema exactly.
     */
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
                "description": "Read the user's uploaded CV/resume as plain text. Returns the full text extracted from their uploaded document.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "read_job",
                "description": "Read the full details of the current job posting including title, company, location, salary, description, requirements, and sponsorship information.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "read_evaluation",
                "description": "Read the most recent saved evaluation for the current job. Returns the full evaluation output if one exists, or a message indicating no evaluation exists yet.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "read_research",
                "description": "Read the most recent saved company research for the current job's company. Returns the research output if one exists.",
                "input_schema": { "type": "object", "properties": {}, "required": [] }
              },
              {
                "name": "web_fetch",
                "description": "Fetch the content of a public URL and return it as plain text. Use this to retrieve job postings from URLs, company pages, or career portals. Maximum 4000 characters returned.",
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
                "description": "Search the web for current information. Use for: salary data, company news, Glassdoor ratings, job market data, company culture information. Returns top 5 results with title, URL, and snippet.",
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
                "description": "Ask the user a clarifying question when you need information that is not in their profile or the job data. This PAUSES the skill run and shows a popup to the user. Use sparingly — only when information is genuinely missing and essential.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "question": { "type": "string", "description": "The specific question to ask the user. Be concise and clear." }
                  },
                  "required": ["question"]
                }
              },
              {
                "name": "save_resume_html",
                "description": "Save the generated ATS-optimised resume HTML to the user's account. Call this after generating the resume HTML in the tailor-resume skill.",
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
                "description": "Update the user's application status for the current job in their tracker/kanban board.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "enum": ["New","Saved","Applied","Interview","Offer","Rejected","Withdrawn"],
                      "description": "New application status"
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
