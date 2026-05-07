package com.careerops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Request body for POST /api/skills/start
 * Used to kick off any of the 14 career-ops skills.
 */
public record SkillStartRequest(

    /** One of the 14 supported skill names. */
    @NotBlank(message = "skillName is required")
    @Pattern(regexp = "^(evaluate|tailor-resume|apply|outreach|research|prep-interview|compare|triage|scan|salary-negotiation|culture-fit|linkedin-optimize|cover-letter|skills-gap-plan)$")
    String skillName,

    /** The UserJob row this skill run is for. Null for triage (queue-wide). */
    UUID userJobId,

    // ── Outreach-specific ──────────────────────────────────────────────────
    /** linkedin | email | follow-up  (outreach skill only) */
    @Pattern(regexp = "^(linkedin|email|follow-up)$")
    String channel,

    /** professional | conversational | direct  (outreach skill only) */
    @Pattern(regexp = "^(professional|conversational|direct)$")
    String tone,

    // ── Apply-specific ─────────────────────────────────────────────────────
    /** null = run all steps, or specific step name  (apply skill only) */
    @Pattern(regexp = "^[a-zA-Z0-9_-]{1,50}$")
    String step,

    // ── Compare-specific ──────────────────────────────────────────────────
    /** List of UserJob IDs to compare (compare skill only, min 2) */
    @Size(max = 5)
    List<UUID> compareJobIds,

    // ── Scan-specific ─────────────────────────────────────────────────────
    /** Company name or careers URL to scan  (scan skill only) */
    @Size(max = 200)
    String scanTarget
) {
    public SkillStartRequest {
        compareJobIds = compareJobIds == null ? List.of() : List.copyOf(compareJobIds);
    }
}
