package com.careerops.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;

/**
 * Unified response envelope for ALL skill endpoints.
 *
 * The frontend always receives this type and branches on `type`:
 *   RESULT            → render skill output panel
 *   QUESTION          → show SkillQuestionModal
 *   PROFILE_INCOMPLETE → show ProfileCompletenessAlert
 *   ERROR             → show error state in skill panel
 */
public record SkillRunResponse(

    Type     type,

    // ── RESULT fields ──────────────────────────────────────────────────────
    /** Structured skill output. Present when type = RESULT. */
    JsonNode data,

    /** Skill name that produced this result (for frontend routing to correct panel) */
    String   skillName,

    // ── QUESTION fields ────────────────────────────────────────────────────
    /** Conversation ID to send back with the answer. Present when type = QUESTION. */
    UUID     conversationId,

    /** The exact question Claude asked. Present when type = QUESTION. */
    String   question,

    // ── PROFILE_INCOMPLETE fields ──────────────────────────────────────────
    /** Human-readable list of missing profile fields. Present when type = PROFILE_INCOMPLETE. */
    List<String> missingFields,

    // ── ERROR fields ───────────────────────────────────────────────────────
    /** User-safe error message. Present when type = ERROR. */
    String   errorMessage

) {
    public enum Type { RESULT, QUESTION, PROFILE_INCOMPLETE, ERROR }

    // ── Factory methods ───────────────────────────────────────────────────

    public static SkillRunResponse result(String skillName, JsonNode data) {
        return new SkillRunResponse(Type.RESULT, data, skillName,
                null, null, null, null);
    }

    public static SkillRunResponse question(UUID conversationId, String question, String skillName) {
        return new SkillRunResponse(Type.QUESTION, null, skillName,
                conversationId, question, null, null);
    }

    public static SkillRunResponse profileIncomplete(String skillName, List<String> missing) {
        return new SkillRunResponse(Type.PROFILE_INCOMPLETE, null, skillName,
                null, null, missing, null);
    }

    public static SkillRunResponse error(String skillName, String message) {
        return new SkillRunResponse(Type.ERROR, null, skillName,
                null, null, null, message);
    }
}
