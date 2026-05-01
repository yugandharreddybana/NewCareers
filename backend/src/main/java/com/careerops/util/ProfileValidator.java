package com.careerops.util;

import com.careerops.model.UserProfile;

/**
 * Section 10 — Task 113
 * Computes a profile completeness score (0–100).
 *
 * Breakdown:
 *   CV uploaded                   → +30
 *   Target roles set              → +20
 *   Tech stack added              → +20
 *   Location set                  → +10
 *   Salary range set              → +10
 *   Min match threshold set       → +10  (was previously part of base 100)
 *   Portfolio (>= 1 project)      → +10  (Section 10 new)
 *   Career goals (title + salary) → +10  (Section 10 new)
 *
 * Total possible = 120, clamped to 100 so existing users can still reach 100%
 * without needing every new field.
 */
public final class ProfileValidator {

    private ProfileValidator() {}

    public static int score(UserProfile p, String activeCvFileName) {
        int pts = 0;

        // Base checks (unchanged from existing completeness logic)
        if (activeCvFileName != null && !activeCvFileName.isBlank()) pts += 30;
        if (p.getTargetRoles() != null && p.getTargetRoles().length > 0)       pts += 20;
        if (p.getTechStack()   != null && p.getTechStack().length   > 0)       pts += 20;
        if (p.getLocation()    != null && !p.getLocation().isBlank())          pts += 10;
        if (p.getSalaryMin()   != null && p.getSalaryMin() > 0
                && p.getSalaryMax() != null && p.getSalaryMax() > 0)           pts += 10;
        if (p.getMinMatchPercent() != null && p.getMinMatchPercent() > 0)      pts += 10;

        // Section 10 — Portfolio: at least 1 project
        if (p.getPortfolioItems() != null && !p.getPortfolioItems().isEmpty()) pts += 10;

        // Section 10 — Career goals: target role title + salary set
        if (p.getGoalTitle()     != null && !p.getGoalTitle().isBlank()
                && p.getGoalSalaryMin() != null && p.getGoalSalaryMin() > 0)  pts += 10;

        return Math.min(pts, 100);
    }
}
