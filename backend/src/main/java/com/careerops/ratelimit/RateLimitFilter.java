package com.careerops.ratelimit;

import com.careerops.exception.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerExecutionChain;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.io.IOException;
import java.time.Duration;
/**
 * Task 131 — per-userId in-memory rate limiter using Bucket4j.
 *
 * Rules:
 *  - 60 requests / minute per authenticated userId (extracted from the
 *    request attribute populated by InternalTrustFilter, with configured
 *    trust-header fallback for direct internal calls.
 *  - Public endpoints (register, login, forgot-password, reset-password,
 *    refresh, health) are excluded from per-user limiting.
 *  - Auth login/register IP brute-force limits live in {@link IpRateLimitFilter}.
 *  - When the bucket is empty the filter returns HTTP 429 with:
 *      - Header  Retry-After: <seconds until next token>
 *      - Body    { "error": "Too many requests …", "status": 429, "timestamp": "..." }
 *
 * Storage:
 *  Redis is the primary shared store when available.
 *  Caffeine remains the local fallback for non-production profiles.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private static final String LEGACY_USER_ID_HEADER = "X-User-Id";

    private final com.github.benmanes.caffeine.cache.Cache<String, Bucket> buckets =
        com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    private final Bandwidth bandwidth;
    private final ObjectMapper mapper;
    private final com.careerops.security.PublicPathPolicy publicPathPolicy;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    @org.springframework.beans.factory.annotation.Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.data.redis.core.StringRedisTemplate redisTemplate;

    @Value("${internal.trust.header:X-Internal-User-Id}")
    private String trustHeader;

    @Value("${ratelimit.require-shared-store:false}")
    private boolean requireSharedStore;

    @Value("${spring.data.redis.host:}")
    private String redisHost;

    public RateLimitFilter(Bandwidth apiBandwidth,
                           ObjectMapper mapper,
                           com.careerops.security.PublicPathPolicy publicPathPolicy) {
        this.bandwidth = apiBandwidth;
        this.mapper = mapper;
        this.publicPathPolicy = publicPathPolicy;
    }

    @PostConstruct
    void validateSharedStoreConfiguration() {
        if (!requireSharedStore) {
            return;
        }
        if (redisTemplate == null) {
            throw new IllegalStateException("Shared rate limiting requires Redis, but no StringRedisTemplate is configured.");
        }

        try {
            String pong = redisTemplate.execute(
                (org.springframework.data.redis.core.RedisCallback<String>) connection -> connection.ping()
            );
            if (pong == null || !"PONG".equalsIgnoreCase(pong)) {
                throw new IllegalStateException("Shared rate limiting requires a reachable Redis instance.");
            }
        } catch (Exception e) {
            throw new IllegalStateException("Shared rate limiting requires a reachable Redis instance.", e);
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain)
            throws ServletException, IOException {

        // 3.002 — Use servletPath to ignore context-path (e.g. /api/v1) for matching
        String path = req.getServletPath();
        if (path == null || path.isEmpty()) {
            path = req.getRequestURI().substring(req.getContextPath().length());
        }

        // Exempt public endpoints
        if (publicPathPolicy.isPublic(path)) {
            chain.doFilter(req, res);
            return;
        }

        // Identify caller

        String userId = resolveUserId(req);
        if (userId == null || userId.isBlank()) {
            // Unauthenticated call — let downstream security handle 401; skip limiting
            chain.doFilter(req, res);
            return;
        }

        // 2.080 — Check for @RateLimited override
        Bandwidth limitToUse = this.bandwidth;
        String bucketKey = userId;
        int redisMax = 60;

        if (handlerMapping != null) {
            try {
                HandlerExecutionChain handlerChain = handlerMapping.getHandler(req);
                if (handlerChain != null && handlerChain.getHandler() instanceof HandlerMethod hm) {
                    RateLimited ann = hm.getMethodAnnotation(RateLimited.class);
                    if (ann == null) {
                        ann = hm.getBeanType().getAnnotation(RateLimited.class);
                    }
                    if (ann != null) {
                        limitToUse = Bandwidth.builder()
                                .capacity(ann.capacity())
                                .refillGreedy(ann.requestsPerMinute(), Duration.ofMinutes(1))
                                .initialTokens(ann.capacity())
                                .build();
                        // Use a specialized key for this limit group to avoid colliding with global budget
                        bucketKey = userId + ":" + hm.getMethod().getName() + ":" + ann.requestsPerMinute();
                        redisMax = ann.requestsPerMinute();
                    }
                }
            } catch (Exception e) {
                log.debug("Handler resolution failed for path={}, ignoring annotation overrides", path);
            }
        }

        boolean allowedByRedis = false;
        boolean redisAttempted = false;

        if (redisTemplate != null && redisHost != null && !redisHost.isBlank()) {
            try {
                String key = "ratelimit:" + bucketKey;
                Long current = redisTemplate.opsForValue().increment(key);
                if (current != null && current == 1) {
                    redisTemplate.expire(key, Duration.ofMinutes(1));
                }
                allowedByRedis = current != null && current <= redisMax;
                redisAttempted = true;
            } catch (Exception e) {
                if (requireSharedStore) {
                    log.error("Redis outage in rate limiter while shared-store mode is required", e);
                    sendSharedStoreUnavailableResponse(res, path);
                    return;
                }
                log.warn("Redis outage in rate limiter, falling back to local Caffeine: {}", e.getMessage());
            }
        } else if (requireSharedStore) {
            log.error("Shared-store rate limiting is required, but RedisTemplate is unavailable");
            sendSharedStoreUnavailableResponse(res, path);
            return;
        }

        long nowSeconds = java.time.Instant.now().getEpochSecond();

        if (redisAttempted) {
            if (allowedByRedis) {
                res.setHeader("X-RateLimit-Limit", String.valueOf(limitToUse.getCapacity()));
                res.setHeader("X-RateLimit-Remaining", String.valueOf(redisMax - 1)); // Simplified
                res.setHeader("X-RateLimit-Reset", String.valueOf(nowSeconds + 60));
                chain.doFilter(req, res);
            } else {
                sendTooManyRequestsResponse(res, userId, path, 1);
            }
            return;
        }

        // Resolve or create a bucket for this user in Caffeine on Redis outage
        final Bandwidth finalLimit = limitToUse;
        Bucket bucket = buckets.get(bucketKey, id ->
            Bucket.builder().addLimit(finalLimit).build()
        );

        // Try to consume one token locally
        var probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            // Pass remaining count as header — useful for frontend throttle UX
            res.setHeader("X-RateLimit-Limit", String.valueOf(finalLimit.getCapacity()));
            res.setHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            res.setHeader("X-RateLimit-Reset", String.valueOf(nowSeconds + 60));
            chain.doFilter(req, res);
        } else {
            long waitSeconds = Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds() + 1;
            sendTooManyRequestsResponse(res, userId, path, waitSeconds);
        }
    }


    private void sendTooManyRequestsResponse(HttpServletResponse res, String userId, String path, long waitSeconds) {
        log.warn("Rate limit breached for userId={} on path={}", userId, path);

        try {
            res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.setHeader("Retry-After", String.valueOf(waitSeconds));

            ErrorResponse body = ErrorResponse.of(
                "Too many requests. Please wait " + waitSeconds + " second(s) before retrying.",
                HttpStatus.TOO_MANY_REQUESTS.value()
            );
            mapper.writeValue(res.getWriter(), body);
        } catch (Exception e) {
            log.warn("failed to write 429 body for path={}", path, e);
        }
    }

    private void sendSharedStoreUnavailableResponse(HttpServletResponse res, String path) {
        try {
            res.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);

            ErrorResponse body = ErrorResponse.of(
                "Rate limiting is temporarily unavailable. Please retry shortly.",
                HttpStatus.SERVICE_UNAVAILABLE.value()
            );
            mapper.writeValue(res.getWriter(), body);
        } catch (Exception e) {
            log.warn("failed to write 503 body for path={}", path, e);
        }
    }

    private String resolveUserId(HttpServletRequest req) {
        Object requestUserId = req.getAttribute("userId");
        if (requestUserId instanceof String userId && !userId.isBlank()) {
            return userId;
        }

        String configuredHeaderUserId = req.getHeader(trustHeader);
        if (configuredHeaderUserId != null && !configuredHeaderUserId.isBlank()) {
            return configuredHeaderUserId;
        }

        String legacyHeaderUserId = req.getHeader(LEGACY_USER_ID_HEADER);
        if (legacyHeaderUserId != null && !legacyHeaderUserId.isBlank()) {
            return legacyHeaderUserId;
        }

        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof String userId && !userId.isBlank()) {
                return userId;
            }
        }

        return null;
    }
}
