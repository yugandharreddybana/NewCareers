package com.careerops.dto;

import java.util.Map;

/**
 * Response for POST /api/skills/run-all/{userJobId}
 *
 * Returns a map of skillName -> SkillRunResponse.
 * Individual skill failures do NOT fail the whole run-all.
 * Each skill either has a RESULT, QUESTION, or ERROR.
 */
public record RunAllSkillsResponse(
    /** Total skills attempted */
    int total,

    /** How many completed successfully */
    int succeeded,

    /** How many failed (errors) */
    int failed,

    /** How many are waiting for user answers (QUESTION type) */
    int pendingAnswers,

    /** Per-skill results keyed by skill name */
    Map<String, SkillRunResponse> results
) {}
