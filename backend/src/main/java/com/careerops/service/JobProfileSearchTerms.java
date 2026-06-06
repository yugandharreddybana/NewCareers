package com.careerops.service;

import com.careerops.model.UserProfile;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Builds deduplicated search keywords from onboarding profile fields used for job-board queries.
 * Uses target roles and professional headline ({@link UserProfile#getGoalTitle()}) only.
 */
public final class JobProfileSearchTerms {

    private JobProfileSearchTerms() {}

    /**
     * Ordered keywords for source APIs: all target roles, then headline if distinct.
     */
    public static List<String> searchKeywords(UserProfile profile) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();

        if (profile != null && profile.getTargetRoles() != null) {
            for (String role : profile.getTargetRoles()) {
                addKeyword(out, seen, role);
            }
        }
        if (profile != null) {
            addKeyword(out, seen, profile.getGoalTitle());
        }

        if (out.isEmpty()) {
            throw new IllegalStateException("No target roles or goal title defined for user profile");
        }
        return out;
    }

    /** First keyword for legacy single-query callers. */
    public static String primaryKeyword(UserProfile profile) {
        List<String> keys = searchKeywords(profile);
        return keys.get(0);
    }

    private static void addKeyword(List<String> out, Set<String> seen, String raw) {
        if (raw == null || raw.isBlank()) return;
        String trimmed = raw.trim();
        String key = trimmed.toLowerCase(Locale.ROOT);
        if (seen.add(key)) {
            out.add(trimmed);
        }
    }
}
