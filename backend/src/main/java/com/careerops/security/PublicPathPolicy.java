package com.careerops.security;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Central source of truth for unauthenticated/public backend routes.
 *
 * Why a runtime component instead of static cross-class constants:
 *   - Keeps SecurityConfig, InternalTrustFilter, and RateLimitFilter aligned.
 *   - Avoids brittle static initialization links during app startup.
 *   - Supports both exact servlet-path checks and Spring Security matcher patterns.
 */
@Component
public final class PublicPathPolicy {

    private static final Set<String> EXACT_PATHS = Set.of(
        "/auth/register",
        "/auth/login",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/refresh",
        "/health",
        "/public/stats",
        "/swagger-ui.html"
    );

    private static final List<String> PREFIX_PATHS = List.of(
        "/referrals/validate",
        "/v3/api-docs",
        "/swagger-ui/"
    );

    private static final String[] SECURITY_PATTERNS = {
        "/auth/register",
        "/auth/login",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/refresh",
        "/health",
        "/public/stats",
        "/referrals/validate/**",
        "/v3/api-docs/**",
        "/swagger-ui/**",
        "/swagger-ui.html"
    };

    public boolean isPublic(String rawPath) {
        final String path = normalize(rawPath);
        if (EXACT_PATHS.contains(path)) {
            return true;
        }
        return PREFIX_PATHS.stream().anyMatch(path::startsWith);
    }

    public String[] securityPatterns() {
        return SECURITY_PATTERNS.clone();
    }

    private String normalize(String path) {
        if (path == null || path.isBlank()) {
            return "";
        }
        if (path.length() > 1 && path.endsWith("/")) {
            return path.substring(0, path.length() - 1);
        }
        return path;
    }
}