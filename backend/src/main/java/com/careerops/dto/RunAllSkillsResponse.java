package com.careerops.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * Response for POST /api/skills/run-all/{userJobId}
 *
 * Contains the result of running all 9 skills in sequence.
 * Individual skill failures do NOT abort the rest — each skill
 * result is independent and may be RESULT, QUESTION, PROFILE_INCOMPLETE, or ERROR.
 *
 * The frontend renders each skill panel independently based on its type.
 * The "Download All PDF" button is enabled once succeeded > 0.
 */
@Data
@Builder
public class RunAllSkillsResponse {

    /**
     * Map of skill name → its SkillRunResponse.
     * Keys: evaluate, tailor-resume, apply, outreach, research,
     *       prep-interview, compare, triage, scan
     */
    private Map<String, SkillRunResponse> skills;

    /** Number of skills that completed successfully (type = RESULT). */
    private int succeeded;

    /** Number of skills that failed (type = ERROR) or need user input (type = QUESTION). */
    private int failed;

    /** Total number of skills attempted (always 9 for run-all). */
    private int total;
}
