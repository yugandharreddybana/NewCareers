package com.careerops.service.sources;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

public final class FingerprintUtil {

    private FingerprintUtil() {}

    public static String fingerprint(String title, String company, String url) {
        try {
            String raw = (title + "|").toLowerCase() + (company + "|").toLowerCase() + url.toLowerCase();
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (Exception e) {
            return Integer.toHexString((title + company + url).hashCode());
        }
    }

    /**
     * Parse human-readable relative date strings like "2 days ago", "Today",
     * "3 hours ago" into an Instant. Returns null when unparseable.
     */
    public static Instant parseRelativeDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.toLowerCase().trim();
        if (s.contains("just now") || s.contains("today") || s.contains("hour")) {
            return Instant.now();
        }
        if (s.contains("yesterday")) return Instant.now().minus(1, ChronoUnit.DAYS);
        try {
            // "X days ago" or "X day ago"
            if (s.contains("day")) {
                int days = Integer.parseInt(s.replaceAll("[^0-9]", "").trim());
                return Instant.now().minus(days, ChronoUnit.DAYS);
            }
            if (s.contains("week")) {
                int weeks = Integer.parseInt(s.replaceAll("[^0-9]", "").trim());
                return Instant.now().minus(weeks * 7L, ChronoUnit.DAYS);
            }
            if (s.contains("month")) {
                int months = Integer.parseInt(s.replaceAll("[^0-9]", "").trim());
                return Instant.now().minus(months * 30L, ChronoUnit.DAYS);
            }
        } catch (Exception ignored) {}
        return null;
    }
}
