package com.careerops.model;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Sealed result type returned by ClaudeAgentService.run().
 *
 * Three possible outcomes:
 * - Done:        Claude finished and returned final text. Save as SkillRun, return to frontend.
 * - NeedsAnswer: Claude called ask_user mid-skill. Save state, surface question to user.
 * - Error:       Something went wrong (API failure, timeout, max iterations). Surface cleanly.
 *
 * Using Java 17 sealed interfaces ensures all cases are handled at the call site.
 */
public sealed interface AgentResult
    permits AgentResult.Done, AgentResult.NeedsAnswer, AgentResult.Error {

    /**
     * Claude completed the skill run successfully.
     * @param text  Raw output text from Claude (may be JSON string or markdown).
     */
    record Done(String text) implements AgentResult {}

    /**
     * Claude called ask_user and is waiting for user input.
     * @param question   The exact question to display to the user in the modal.
     * @param messages   Full conversation history snapshot as JSONB (for DB persistence).
     * @param toolUseId  Claude's tool_use_id for the ask_user call (required for resumption).
     */
    record NeedsAnswer(
        String   question,
        JsonNode messages,
        String   toolUseId
    ) implements AgentResult {}

    /**
     * Skill run failed. Message is user-safe (no stack traces, no internal details).
     * @param message  Human-readable error description.
     */
    record Error(String message) implements AgentResult {}

    // ── Factory methods ──────────────────────────────────────────────────────

    static AgentResult done(String text) {
        return new Done(text);
    }

    static AgentResult needsAnswer(String question, JsonNode messages, String toolUseId) {
        return new NeedsAnswer(question, messages, toolUseId);
    }

    static AgentResult error(String message) {
        return new Error(message);
    }
}
