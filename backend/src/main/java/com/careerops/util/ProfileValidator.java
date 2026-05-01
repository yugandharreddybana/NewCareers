package com.careerops.util;

import com.careerops.model.UserProfile;

import java.util.List;
import java.util.Map;

/**
 * Section 10 Task 113 — profile completeness score (0-100).
 *
 * Breakdown:
 *   CV uploaded            30%
 *   Target roles set       20%
 *   Tech stack added       10%   (was 20%, shifted 10 to new items)
 *   Location set           10%
 *   Salary range set       10%
 *   Match threshold set     0%   (implicit — always present after onboarding)
 *   Portfolio (≥1 project) 10%   ← NEW Section 10
 *   Career goals set       10%   ← NEW Section 10 (goalTitle + at least one salary)
 */
public final class ProfileValidator {

    private ProfileValidator() {}

    public static int completenessScore(UserProfile p, boolean hasCv) {
        int score = 0;

        if (hasCv)                                                       score += 30;
        if (p.getTargetRoles() != null && p.getTargetRoles().length > 0) score += 20;
        if (p.getTechStack()   != null && p.getTechStack().length   > 0) score += 10;
        if (p.getLocation()    != null && !p.getLocation().isBlank())    score += 10;
        if (p.getSalaryMin()   != null && p.getSalaryMin() > 0
         && p.getSalaryMax()   != null && p.getSalaryMax() > 0)          score += 10;

        // Section 10 — portfolio (≥1 project) = +10%
        List<Map<String, Object>> portfolio = p.getPortfolioItems();
        if (portfolio != null && !portfolio.isEmpty())                   score += 10;

        // Section 10 — career goals (title + at least one salary bound) = +10%
        boolean hasGoalTitle  = p.getGoalTitle() != null && !p.getGoalTitle().isBlank();
        boolean hasGoalSalary = p.getGoalSalaryMin() != null || p.getGoalSalaryMax() != null;
        if (hasGoalTitle && hasGoalSalary)                               score += 10;

        return Math.min(score, 100);
    }
}
