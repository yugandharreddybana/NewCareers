package com.careerops.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Shared client IP resolution for rate limiting and refresh-token binding.
 * Honors {@code X-Forwarded-For} only when {@code TRUSTED_PROXY=true|1} or the
 * immediate remote address is loopback (middleware on same host).
 */
public final class TrustedProxyIpResolver {

    private TrustedProxyIpResolver() {}

    public static String resolveClientIp(HttpServletRequest req) {
        if (trustForwardedFor(req)) {
            String forwarded = req.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
        }
        return req.getRemoteAddr();
    }

    public static boolean trustForwardedFor(HttpServletRequest req) {
        String trusted = System.getenv("TRUSTED_PROXY");
        if ("true".equalsIgnoreCase(trusted) || "1".equals(trusted)) {
            return true;
        }
        String remote = req.getRemoteAddr();
        return "127.0.0.1".equals(remote)
                || "::1".equals(remote)
                || "0:0:0:0:0:0:0:1".equals(remote);
    }
}
