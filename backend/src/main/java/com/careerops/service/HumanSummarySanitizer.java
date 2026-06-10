package com.careerops.service;

import com.careerops.security.AesGcmCodec;

import java.util.regex.Pattern;

/**
 * Strips legacy {@code Headline: …} prefixes (including encrypted goal titles) from stored summaries.
 */
public final class HumanSummarySanitizer {

    private static final Pattern HEADLINE_PREFIX =
            Pattern.compile("^Headline:\\s*[^.]+\\.\\s*", Pattern.CASE_INSENSITIVE);

    private HumanSummarySanitizer() {}

    public static String sanitize(String summary) {
        if (summary == null || summary.isBlank()) {
            return summary;
        }
        String trimmed = summary.trim();
        if (containsEncryptedHeadline(trimmed)) {
            String stripped = HEADLINE_PREFIX.matcher(trimmed).replaceFirst("").trim();
            return stripped.isEmpty() ? null : stripped;
        }
        return trimmed;
    }

    public static boolean containsEncryptedHeadline(String summary) {
        if (summary == null || summary.isBlank()) {
            return false;
        }
        if (!summary.regionMatches(true, 0, "Headline:", 0, "Headline:".length())) {
            return false;
        }
        int dot = summary.indexOf('.');
        if (dot <= "Headline:".length()) {
            return false;
        }
        String headlineValue = summary.substring("Headline:".length(), dot).trim();
        return AesGcmCodec.looksEncrypted(headlineValue);
    }
}
