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
 * Populates {@link org.springframework.security.core.context.SecurityContext} from the
 * user id header injected by Node middleware on internal calls.
 *
 * Request authenticity is verified upstream by {@link HmacVerificationFilter}.
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

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String path = ServletPathNormalizer.normalize(req);

        // Allow truly-public endpoints through without auth
        if (publicPathPolicy.isPublic(path)) {
            chain.doFilter(req, res);
            return;
        }

        String userId = req.getHeader(trustHeader);

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


