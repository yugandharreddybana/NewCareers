package com.careerops.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
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

    private static final Set<String> BASE_EXACT_PATHS = Set.of(
        "/auth/register",
        "/auth/login",
        "/auth/signup-intent",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/refresh",
        "/auth/google",
        "/auth/two-factor/verify",
        "/auth/google/link/confirm",
        "/auth/onboarding/check-email",
        "/auth/onboarding/check-password",
        "/auth/onboarding/send-verification-otp",
        "/auth/onboarding/resend-verification-otp",
        "/auth/onboarding/verify-email",
        "/auth/onboarding/parse-cv",
        "/auth/captcha/challenge",
        "/health",
        "/public/stats",
        "/.well-known/jwks.json",
        "/billing/plans",
        "/billing/webhook"
    );

    private static final Set<String> SWAGGER_EXACT_PATHS = Set.of("/swagger-ui.html");
    private static final List<String> SWAGGER_PREFIX_PATHS = List.of("/v3/api-docs", "/swagger-ui/");

    private static final List<String> BASE_PREFIX_PATHS = List.of("/referrals/validate");

    private final Environment environment;

    public PublicPathPolicy(Environment environment) {
        this.environment = environment;
    }

    private static final String[] BASE_SECURITY_PATTERNS = {
        "/auth/register",
        "/auth/login",
        "/auth/signup-intent",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/refresh",
        "/auth/google",
        "/auth/two-factor/verify",
        "/auth/google/link/confirm",
        "/auth/onboarding/check-email",
        "/auth/onboarding/check-password",
        "/auth/onboarding/send-verification-otp",
        "/auth/onboarding/resend-verification-otp",
        "/auth/onboarding/verify-email",
        "/auth/onboarding/parse-cv",
        "/auth/captcha/challenge",
        "/health",
        "/public/stats",
        "/.well-known/jwks.json",
        "/billing/plans",
        "/billing/webhook",
        "/referrals/validate/**"
    };

    private static final String[] SWAGGER_SECURITY_PATTERNS = {
        "/v3/api-docs/**",
        "/swagger-ui/**",
        "/swagger-ui.html"
    };

    public boolean isPublic(HttpServletRequest request) {
        return isPublic(ServletPathNormalizer.normalize(request));
    }

    public boolean isPublic(String rawPath) {
        final String path = normalize(rawPath);
        if (BASE_EXACT_PATHS.contains(path)) {
            return true;
        }
        if (swaggerEnabled() && SWAGGER_EXACT_PATHS.contains(path)) {
            return true;
        }
        if (BASE_PREFIX_PATHS.stream().anyMatch(path::startsWith)) {
            return true;
        }
        return swaggerEnabled() && SWAGGER_PREFIX_PATHS.stream().anyMatch(path::startsWith);
    }

    public String[] securityPatterns() {
        if (!swaggerEnabled()) {
            return BASE_SECURITY_PATTERNS.clone();
        }
        List<String> patterns = new ArrayList<>(List.of(BASE_SECURITY_PATTERNS));
        patterns.addAll(List.of(SWAGGER_SECURITY_PATTERNS));
        return patterns.toArray(String[]::new);
    }

    private boolean swaggerEnabled() {
        return !environment.acceptsProfiles(Profiles.of("prod"));
    }

    private String normalize(String path) {
        return ServletPathNormalizer.normalizePath(path);
    }
}
