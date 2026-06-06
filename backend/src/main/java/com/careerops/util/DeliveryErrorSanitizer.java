package com.careerops.util;

/**
 * Strips internal exception text before it is persisted or returned to clients.
 */
public final class DeliveryErrorSanitizer {

    private static final String GENERIC =
            "Job matching hit a snag — try again from the dashboard.";

    private DeliveryErrorSanitizer() {}

    public static String forClient(Throwable error) {
        if (error == null) {
            return GENERIC;
        }
        return forClient(error.getMessage());
    }

    public static String forClient(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String lower = raw.toLowerCase();
        if (lower.contains("duplicate key")
                || lower.contains("constraint")
                || lower.contains("jdbc")
                || lower.contains("hibernate")
                || lower.contains("sql ")
                || lower.contains("insert into")
                || lower.contains("org.")
                || raw.length() > 240) {
            return GENERIC;
        }
        return raw;
    }
}
