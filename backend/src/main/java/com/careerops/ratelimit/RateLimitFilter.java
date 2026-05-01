package com.careerops.ratelimit;

import com.careerops.exception.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Task 131 — per-userId in-memory rate limiter using Bucket4j.
 *
 * Rules:
 *  - 60 requests / minute per authenticated userId (extracted from the
 *    X-User-Id trust header set by InternalTrustFilter).
 *  - Public endpoints (register, login, forgot-password, reset-password,
 *    refresh, health) are excluded — they have their own brute-force
 *    protections in AuthService.
 *  - When the bucket is empty the filter returns HTTP 429 with:
 *      - Header  Retry-After: <seconds until next token>
 *      - Body    { "error": "Too many requests …", "status": 429, "timestamp": "..." }
 *
 * Storage:
 *  ConcurrentHashMap<userId, Bucket> — in-process, no Redis required.
 *  Buckets are never explicitly evicted (low user counts make this fine;
 *  add Caffeine eviction in a future section if needed).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    /** Trust-header name injected by InternalTrustFilter. */
    private static final String USER_ID_HEADER = "X-User-Id";

    /** Endpoints that bypass rate limiting entirely. */
    private static final Set<String> EXEMPT_PATHS = Set.of(
        "/auth/register",
        "/auth/login",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/refresh",
        "/health"
    );

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final Bandwidth bandwidth;
    private final ObjectMapper mapper;

    public RateLimitFilter(Bandwidth apiBandwidth) {
        this.bandwidth = apiBandwidth;
        this.mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain)
            throws ServletException, IOException {

        String path = req.getRequestURI();

        // Exempt public endpoints
        if (EXEMPT_PATHS.contains(path)) {
            chain.doFilter(req, res);
            return;
        }

        // Identify caller
        String userId = req.getHeader(USER_ID_HEADER);
        if (userId == null || userId.isBlank()) {
            // Unauthenticated call — let downstream security handle 401; skip limiting
            chain.doFilter(req, res);
            return;
        }

        // Resolve or create a bucket for this user
        Bucket bucket = buckets.computeIfAbsent(userId, id ->
            Bucket.builder().addLimit(bandwidth).build()
        );

        // Try to consume one token
        var probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            // Pass remaining count as header — useful for frontend throttle UX
            res.setHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            chain.doFilter(req, res);
        } else {
            long waitSeconds = Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds() + 1;
            log.warn("Rate limit breached for userId={} on path={}", userId, path);

            res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.setHeader("Retry-After", String.valueOf(waitSeconds));

            ErrorResponse body = ErrorResponse.of(
                "Too many requests. Please wait " + waitSeconds + " second(s) before retrying.",
                HttpStatus.TOO_MANY_REQUESTS.value()
            );
            mapper.writeValue(res.getWriter(), body);
        }
    }
}
