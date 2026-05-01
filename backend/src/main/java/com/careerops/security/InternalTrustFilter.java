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
import java.util.Set;

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

    @Value("${internal.trust.header}")
    private String trustHeader;

    @Value("${internal.trust.secret}")
    private String trustSecret;

    private static final String SECRET_HEADER = "X-Internal-Secret";

    /** Exact paths that do NOT require authentication. */
    private static final Set<String> PUBLIC_PATHS = Set.of(
        "/auth/register",
        "/auth/login",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/refresh",
        "/health"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String path = req.getRequestURI();

        // Allow truly-public endpoints through without auth
        if (PUBLIC_PATHS.contains(path)) {
            chain.doFilter(req, res);
            return;
        }

        String secret = req.getHeader(SECRET_HEADER);
        String userId = req.getHeader(trustHeader);

        if (secret != null && secret.equals(trustSecret) && userId != null && !userId.isBlank()) {
            req.setAttribute("userId", userId); // expose for @RequestAttribute
            var auth = new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(req, res);
    }
}
