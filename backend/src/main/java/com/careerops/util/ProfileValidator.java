package com.careerops.util;

import com.careerops.model.UserProfile;

/**
 * Section 10 — Task 113
 * Calculates the profile completeness score (0–100) for a given UserProfile.
 *
 * Scoring breakdown:
 *   CV uploaded           = 30 pts  (checked by caller via activeCvFileName)
 *   Target roles set      = 20 pts
 *   Tech stack added      = 20 pts
 *   Location set          = 10 pts
 *   Salary range set      = 10 pts
 *   Match threshold set   = 10 pts
 *   ----  Section 10 additions  ----
 *   Portfolio (>=1 item)  = 10 pts  (bonus; total cap = 100)
 *   Career goal set       = 10 pts  (bonus; total cap = 100)
 *
 * Note: the bonus points replace the match-threshold and location points
 * when present, so the maximum is always 100.
 */
public class ProfileValidator {

    private ProfileValidator() {}

    /**
     * @param profile           the user's profile entity
     * @param hasCv             whether the user has an active CV uploaded
     * @return                  completeness percentage (0–100)
     */
    public static int completeness(UserProfile profile, boolean hasCv) {
        int score = 0;

        // ─ Original checks ────────────────────────────────────────────────
        if (hasCv)                                                    score += 30;
        if (profile.getTargetRoles()   != null
                && profile.getTargetRoles().length > 0)               score += 20;
        if (profile.getTechStack()     != null
                && profile.getTechStack().length > 0)                 score += 20;
        if (profile.getLocation()      != null
                && !profile.getLocation().isBlank())                  score += 10;
        if (profile.getSalaryMin()     != null
                && profile.getSalaryMax() != null)                    score += 10;
        if (profile.getMinMatchPercent() != null
                && profile.getMinMatchPercent() > 0)                  score += 10;

        // ─ Section 10 bonus checks (cap at 100) ───────────────────────────
        if (profile.getPortfolioItems() != null
                && !profile.getPortfolioItems().isEmpty())            score += 10;

        boolean hasGoal = profile.getGoalTitle()     != null
                && !profile.getGoalTitle().isBlank()
                && profile.getGoalSalaryMin() != null
                && profile.getGoalSalaryMax() != null;
        if (hasGoal)                                                   score += 10;

        return Math.min(score, 100);
    }
}
