package com.careerops.util;

import org.jspecify.annotations.Nullable;

/**
 * Lightweight User-Agent → friendly device label (no external dependency).
 */
public final class UserAgentParser {

    private UserAgentParser() {}

    public static String friendlyLabel(@Nullable String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown device";
        }
        String ua = userAgent;
        String browser = detectBrowser(ua);
        String os = detectOs(ua);
        if (!"Unknown".equals(browser) && !"Unknown".equals(os)) {
            return browser + " on " + os;
        }
        if (!"Unknown".equals(browser)) {
            return browser;
        }
        if (!"Unknown".equals(os)) {
            return os;
        }
        return truncate(ua, 48);
    }

    public static boolean isMobile(@Nullable String userAgent) {
        if (userAgent == null) return false;
        String ua = userAgent.toLowerCase();
        return ua.contains("iphone")
                || ua.contains("ipad")
                || ua.contains("android")
                || ua.contains("mobile");
    }

    private static String detectBrowser(String ua) {
        if (ua.contains("Edg/")) return "Edge";
        if (ua.contains("Chrome/") && !ua.contains("Chromium")) return "Chrome";
        if (ua.contains("Firefox/")) return "Firefox";
        if (ua.contains("Safari/") && !ua.contains("Chrome/")) return "Safari";
        if (ua.contains("Opera") || ua.contains("OPR/")) return "Opera";
        return "Unknown";
    }

    private static String detectOs(String ua) {
        if (ua.contains("iPhone")) return "iOS";
        if (ua.contains("iPad")) return "iPadOS";
        if (ua.contains("Android")) return "Android";
        if (ua.contains("Mac OS X") || ua.contains("Macintosh")) return "macOS";
        if (ua.contains("Windows NT")) return "Windows";
        if (ua.contains("Linux")) return "Linux";
        return "Unknown";
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
