package com.careerops.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Java only trusts userId injected by Node middleware on internal calls.
 *
 * Fix (Issue 4) — previously this skipped ALL /auth/** paths, which meant
 * /auth/logout received no authentication and @RequestAttribute("userId")
 * would be null at runtime (500).  Now only the 5 truly-public endpoints
 * are skipped; /auth/logout goes through normal trust-header validation.
 *
 * Public (unauthenticated) endpoints:
 *   POST /auth/register
 *   POST /auth/login
 *   POST /auth/forgot-password
 *   POST /auth/reset-password
 *   POST /auth/refresh
 *   GET  /health
 */
@Component
public class InternalTrustFilter extends OncePerRequestFilter {

    private final com.careerops.security.PublicPathPolicy publicPathPolicy;

    public InternalTrustFilter(com.careerops.security.PublicPathPolicy publicPathPolicy) {
        this.publicPathPolicy = publicPathPolicy;
    }

    @Value("${internal.trust.header}")
    private String trustHeader;

    @Value("${internal.trust.secret}")
    private String trustSecret;

    @jakarta.annotation.PostConstruct
    public void validateConfig() {
        if (trustSecret == null || trustSecret.length() < 32 || trustSecret.equals("CHANGE_ME_LONG_RANDOM_STRING")) {
            throw new IllegalStateException("FATAL: internal.trust.secret is too short or uses default value. " +
                    "It must be at least 32 characters long for production security.");
        }
    }

    private static final String SECRET_HEADER = "X-Internal-Secret";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String path = req.getServletPath();
        if (path == null || path.isEmpty()) {
            path = req.getRequestURI().substring(req.getContextPath().length());
        }
        if (path != null && path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }

        // Allow truly-public endpoints through without auth
        if (publicPathPolicy.isPublic(path)) {
            chain.doFilter(req, res);
            return;
        }

        String secret = req.getHeader(SECRET_HEADER);
        String userId = req.getHeader(trustHeader);

        boolean secretValid = false;
        if (secret != null && trustSecret != null && secret.length() == trustSecret.length()) {
            secretValid = java.security.MessageDigest.isEqual(
                secret.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                trustSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8)
            );
        }

        if (!secretValid) {
            logger.warn("Access denied in InternalTrustFilter on path=" + path + " from IP=" + req.getRemoteAddr());
            incrementFailedTrustCounter();
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\": \"Unauthorized: Invalid or missing secret\"}");
            return;
        }

        boolean userIdValid = false;
        if (userId != null && !userId.isBlank() && userId.length() <= 64) {
            if (userId.matches("^[0-9a-fA-F-]{36}$") || userId.matches("^\\d+$")) {
                userIdValid = true;
            }
        }

        if (!userIdValid) {
            logger.warn("Malformed or missing userId in InternalTrustFilter on path=" + path + " from IP=" + req.getRemoteAddr());
            incrementFailedTrustCounter();
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\": \"Unauthorized: Malformed userId\"}");
            return;
        }


        req.setAttribute("userId", userId); // expose for @RequestAttribute
        var auth = new UsernamePasswordAuthenticationToken(
            userId, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);

        org.slf4j.MDC.put("userId", userId);
        try {
            chain.doFilter(req, res);
        } finally {
            org.slf4j.MDC.remove("userId");
        }
    }

    private void incrementFailedTrustCounter() {
        try {
            Class<?> registryClass = Class.forName("io.micrometer.core.instrument.Metrics");
            java.lang.reflect.Method counterMethod = registryClass.getMethod("counter", String.class, String[].class);
            Object counter = counterMethod.invoke(null, "security.trust.failed", new String[0]);
            java.lang.reflect.Method incrementMethod = counter.getClass().getMethod("increment");
            incrementMethod.invoke(counter);
        } catch (Exception ignored) {
            // Micrometer not available on classpath, fallback gracefully
        }
    }
}


