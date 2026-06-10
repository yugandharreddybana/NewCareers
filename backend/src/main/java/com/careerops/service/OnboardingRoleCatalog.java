package com.careerops.service;

import java.util.List;
import java.util.Locale;

/**
 * Canonical onboarding role chips — kept in sync with frontend {@code SUGGESTED_ROLES}.
 */
public final class OnboardingRoleCatalog {

    public static final List<String> SUGGESTED_ROLES = List.of(
        "Senior Product Designer",
        "UX Lead",
        "Product Manager",
        "Frontend Architect",
        "Software Engineer",
        "Full Stack Developer",
        "Backend Engineer",
        "Data Engineer"
    );

    private OnboardingRoleCatalog() {}

    /** Case-insensitive match to catalog label; otherwise returns trimmed custom title. */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String trimmed = raw.trim();
        if (trimmed.length() > 80) {
            trimmed = trimmed.substring(0, 80);
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        for (String catalog : SUGGESTED_ROLES) {
            if (catalog.toLowerCase(Locale.ROOT).equals(lower)) {
                return catalog;
            }
        }
        return trimmed;
    }

    public static String promptCatalogHint() {
        return String.join(", ", SUGGESTED_ROLES);
    }
}
