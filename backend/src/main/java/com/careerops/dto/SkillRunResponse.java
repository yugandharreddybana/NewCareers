package com.careerops.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/**
 * Unified response envelope for all skill endpoints.
 *
 * The frontend inspects `type` to decide what to render:
 *   RESULT           → show the skill output panel
 *   QUESTION         → show SkillQuestionModal with the question
 *   PROFILE_INCOMPLETE → show ProfileCompletenessAlert with missing fields
 *   ERROR            → show inline error message, no modal
 *
 * All fields except `type` and `skill` are nullable (JsonInclude.NON_NULL
 * ensures they are omitted from JSON when null, keeping responses lean).
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SkillRunResponse {

    public enum Type {
        RESULT,
        QUESTION,
        PROFILE_INCOMPLETE,
        ERROR
    }

    private Type   type;
    private String skill;

    // ── RESULT fields ────────────────────────────────────────────────────────
    /** Structured output from Claude. Schema depends on the skill. */
    private JsonNode data;

    /**
     * Set only by tailor-resume. Supabase path for the generated resume file.
     * Used by the frontend to construct the PDF download URL.
     */
    private String resumeFilename;

    // ── QUESTION fields ──────────────────────────────────────────────────────
    /** ID of the saved SkillConversation. Sent back in ConversationReplyRequest. */
    private UUID conversationId;

    /** The exact question Claude asked. Displayed verbatim in SkillQuestionModal. */
    private String question;

    // ── PROFILE_INCOMPLETE fields ─────────────────────────────────────────────
    /**
     * Human-readable list of missing profile fields.
     * e.g. ["Upload your CV", "Set at least one target role", "Add your name"]
     */
    private List<String> missingFields;

    // ── ERROR field ───────────────────────────────────────────────────────────
    /** User-safe error message. Never contains stack traces or internal details. */
    private String error;

    // ── Factory methods ───────────────────────────────────────────────────────

    public static SkillRunResponse result(String skill, JsonNode data) {
        return SkillRunResponse.builder()
                .type(Type.RESULT).skill(skill).data(data).build();
    }

    public static SkillRunResponse resultWithResume(String skill, JsonNode data, String resumeFilename) {
        return SkillRunResponse.builder()
                .type(Type.RESULT).skill(skill).data(data)
                .resumeFilename(resumeFilename).build();
    }

    public static SkillRunResponse question(String skill, UUID conversationId, String question) {
        return SkillRunResponse.builder()
                .type(Type.QUESTION).skill(skill)
                .conversationId(conversationId).question(question).build();
    }

    public static SkillRunResponse profileIncomplete(String skill, List<String> missingFields) {
        return SkillRunResponse.builder()
                .type(Type.PROFILE_INCOMPLETE).skill(skill)
                .missingFields(missingFields).build();
    }

    public static SkillRunResponse error(String skill, String message) {
        return SkillRunResponse.builder()
                .type(Type.ERROR).skill(skill).error(message).build();
    }
}
