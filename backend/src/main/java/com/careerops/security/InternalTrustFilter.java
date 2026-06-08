package com.careerops.security;

import com.careerops.model.User;
import com.careerops.repository.UserRepository;
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
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Populates {@link org.springframework.security.core.context.SecurityContext} from the
 * user id header injected by Node middleware on internal calls.
 *
 * Request authenticity is verified upstream by {@link HmacVerificationFilter}.
 */
@Component
public class InternalTrustFilter extends OncePerRequestFilter {

    private static final Pattern UUID_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private final PublicPathPolicy publicPathPolicy;
    private final UserRepository users;

    public InternalTrustFilter(PublicPathPolicy publicPathPolicy, UserRepository users) {
        this.publicPathPolicy = publicPathPolicy;
        this.users = users;
    }

    @Value("${internal.trust.header}")
    private String trustHeader;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String path = ServletPathNormalizer.normalize(req);

        if (publicPathPolicy.isPublic(path)) {
            chain.doFilter(req, res);
            return;
        }

        String userId = req.getHeader(trustHeader);

        if (userId == null || userId.isBlank() || !UUID_PATTERN.matcher(userId).matches()) {
            logger.warn("Malformed or missing userId in InternalTrustFilter on path=" + path + " from IP=" + req.getRemoteAddr());
            incrementFailedTrustCounter();
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\": \"Unauthorized: Malformed userId\"}");
            return;
        }

        req.setAttribute("userId", userId);

        String roleAuthority = "ROLE_USER";
        try {
            UUID parsed = UUID.fromString(userId);
            roleAuthority = users.findById(parsed)
                    .map(User::getRole)
                    .map(r -> "ROLE_" + r.name())
                    .orElse("ROLE_USER");
        } catch (IllegalArgumentException ignored) {
            // UUID_PATTERN already validated format; defensive fallback only.
        }

        var auth = new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority(roleAuthority))
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
