package com.careerops.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/**
 * Request body for POST /api/skills/start
 *
 * skillName is always required. All other fields are skill-specific:
 *   outreach:  channel + tone
 *   apply:     step (null = full application)
 *   compare:   compareJobIds (2–5 UUIDs)
 *   triage:    no extra params needed
 *   scan:      companyName
 *
 * userJobId is required for all job-level skills.
 * It is null for triage (operates on the user's full queue).
 */
@Data
public class SkillStartRequest {

    @NotBlank(message = "skillName is required")
    private String skillName;

    /** Target UserJob. Null only for triage. */
    private UUID userJobId;

    // ── outreach params ──────────────────────────────────────────────────────
    /** "linkedin" | "email" | "follow-up" */
    private String channel;

    /** "professional" | "conversational" | "direct" */
    private String tone;

    // ── apply params ─────────────────────────────────────────────────────────
    /** Which step of the application form to help with. Null = full application. */
    private String step;

    // ── compare params ───────────────────────────────────────────────────────
    /** 2–5 UserJob IDs to compare side by side. */
    private List<UUID> compareJobIds;

    // ── scan params ──────────────────────────────────────────────────────────
    /** Company name or careers URL to scan. "all" = scan the user's watchlist. */
    private String companyTarget;
}
