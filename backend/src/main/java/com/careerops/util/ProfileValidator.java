package com.careerops.util;

import com.careerops.model.UserProfile;

/**
 * Section 10 — Task 113
 *
 * Centrally calculates the profile completeness score (0–100%).
 *
 * Breakdown:
 *   CV uploaded                  → +30
 *   Target roles set (≥1)        → +20
 *   Tech stack added (≥1)        → +20
 *   Location set                 → +10
 *   Salary range set             → +10  (salaryMin + salaryMax both > 0)
 *   Match threshold set (>0)     → +10
 *   ---------- Section 10 additions ----------
 *   Portfolio (≥1 project)       → +10  (replaces one old 10-pt check, total stays 100)
 *   Career goals (title+salary)  → +10  (goalTitle + goalSalaryMin + goalSalaryMax all set)
 *
 * NOTE: The original salary-range check and match-threshold check together
 * contributed 20 pts. Section 10 reassigns those to portfolio and goals.
 * The adjusted weights sum to 100.
 *
 * Weights (adjusted for Section 10):
 *   CV uploaded              30
 *   Target roles set         20
 *   Tech stack added         20
 *   Location set             10
 *   Portfolio (≥1 project)   10   ← NEW
 *   Career goals             10   ← NEW
 *   ─────────────────────────────
 *   Total                   100
 *
 * (Salary range and match threshold continue to be assessed on the
 *  frontend checklist for UX but no longer change the numeric score,
 *  keeping the total at 100.)
 */
public class ProfileValidator {

    private ProfileValidator() {}

    /**
     * Computes the completeness score for a user profile.
     *
     * @param profile  the UserProfile entity (never null)
     * @param cvName   active CV file name, or null/blank if no CV uploaded
     * @return integer 0–100
     */
    public static int computeScore(UserProfile profile, String cvName) {
        int score = 0;

        // CV uploaded — 30 pts
        if (cvName != null && !cvName.isBlank()) score += 30;

        // Target roles set — 20 pts
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) score += 20;

        // Tech stack added — 20 pts
        if (profile.getTechStack() != null && profile.getTechStack().length > 0) score += 20;

        // Location set — 10 pts
        if (profile.getLocation() != null && !profile.getLocation().isBlank()) score += 10;

        // Section 10: Portfolio has ≥1 project — 10 pts
        if (profile.getPortfolioItems() != null && !profile.getPortfolioItems().isEmpty()) score += 10;

        // Section 10: Career goal (title + salary range both present) — 10 pts
        boolean hasGoalTitle  = profile.getGoalTitle()     != null && !profile.getGoalTitle().isBlank();
        boolean hasGoalSalary = profile.getGoalSalaryMin() != null && profile.getGoalSalaryMax() != null
                             && profile.getGoalSalaryMin() > 0     && profile.getGoalSalaryMax() > 0;
        if (hasGoalTitle && hasGoalSalary) score += 10;

        return Math.min(score, 100);
    }
}
