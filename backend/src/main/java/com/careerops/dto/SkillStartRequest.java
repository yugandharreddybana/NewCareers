package com.careerops.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;

/**
 * Request body for POST /api/skills/start
 * Used to kick off any of the 9 career-ops skills.
 */
public record SkillStartRequest(

    /** One of: evaluate, tailor-resume, apply, outreach, research,
     *  prep-interview, compare, triage, scan */
    @NotBlank(message = "skillName is required")
    String skillName,

    /** The UserJob row this skill run is for. Null for triage (queue-wide). */
    UUID userJobId,

    // ── Outreach-specific ──────────────────────────────────────────────────
    /** linkedin | email | follow-up  (outreach skill only) */
    String channel,

    /** professional | conversational | direct  (outreach skill only) */
    String tone,

    // ── Apply-specific ─────────────────────────────────────────────────────
    /** null = run all steps, or specific step name  (apply skill only) */
    String step,

    // ── Compare-specific ──────────────────────────────────────────────────
    /** List of UserJob IDs to compare (compare skill only, min 2) */
    List<UUID> compareJobIds,

    // ── Scan-specific ─────────────────────────────────────────────────────
    /** Company name or careers URL to scan  (scan skill only) */
    String scanTarget
) {}
