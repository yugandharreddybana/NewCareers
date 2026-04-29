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
 * Public auth endpoints (/auth/**) skip this filter.
 */
@Component
public class InternalTrustFilter extends OncePerRequestFilter {

    @Value("${internal.trust.header}")
    private String trustHeader;

    @Value("${internal.trust.secret}")
    private String trustSecret;

    private static final String SECRET_HEADER = "X-Internal-Secret";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String path = req.getRequestURI();
        if (path.startsWith("/auth/") || path.equals("/health")) {
            chain.doFilter(req, res);
            return;
        }

        String secret = req.getHeader(SECRET_HEADER);
        String userId = req.getHeader(trustHeader);

        if (secret != null && secret.equals(trustSecret) && userId != null && !userId.isBlank()) {
            var auth = new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(req, res);
    }
}
