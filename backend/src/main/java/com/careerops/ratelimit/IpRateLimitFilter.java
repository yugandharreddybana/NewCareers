package com.careerops.ratelimit;

import com.careerops.exception.ErrorResponse;
import com.careerops.security.ServletPathNormalizer;
import com.careerops.security.TrustedProxyIpResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
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

/**
 * Per-IP rate limiter for auth brute-force endpoints.
 * 20 requests per minute per IP per path; returns HTTP 429 with Retry-After: 60.
 */
@Component
public class IpRateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(IpRateLimitFilter.class);
    private static final long RETRY_AFTER_SECONDS = 60;
    private static final int REQUESTS_PER_MINUTE = 20;

    private static final Set<String> LIMITED_PATHS = Set.of(
        "/auth/register",
        "/auth/signup-intent",
        "/auth/login",
            "/auth/google",
            "/auth/refresh",
            "/auth/forgot-password",
            "/auth/reset-password",
            "/auth/captcha/challenge",
            "/auth/onboarding/check-email",
            "/auth/onboarding/check-password",
            "/auth/onboarding/send-verification-otp",
            "/auth/onboarding/resend-verification-otp",
            "/auth/onboarding/verify-email",
            "/auth/onboarding/parse-cv"
    );

    private final com.github.benmanes.caffeine.cache.Cache<String, Bucket> buckets =
            com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
                    .maximumSize(100_000)
                    .expireAfterAccess(Duration.ofHours(1))
                    .build();

    private final Bandwidth authBandwidth = Bandwidth.builder()
            .capacity(REQUESTS_PER_MINUTE)
            .refillGreedy(REQUESTS_PER_MINUTE, Duration.ofMinutes(1))
            .initialTokens(REQUESTS_PER_MINUTE)
            .build();

    private final ObjectMapper mapper;

    public IpRateLimitFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain)
            throws ServletException, IOException {

        String path = ServletPathNormalizer.normalize(req);

        if (!LIMITED_PATHS.contains(path)) {
            chain.doFilter(req, res);
            return;
        }

        String clientIp = TrustedProxyIpResolver.resolveClientIp(req);
        String bucketKey = path + ":" + clientIp;
        Bucket bucket = buckets.get(bucketKey, key ->
                Bucket.builder().addLimit(authBandwidth).build());

        if (!bucket.tryConsume(1)) {
            sendTooManyRequests(res, clientIp, path);
            return;
        }

        chain.doFilter(req, res);
    }

    private void sendTooManyRequests(HttpServletResponse res, String clientIp, String path) {
        log.warn("Auth IP rate limit breached for ip={} on path={}", clientIp, path);
        try {
            res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.setHeader("Retry-After", String.valueOf(RETRY_AFTER_SECONDS));
            mapper.writeValue(res.getWriter(), ErrorResponse.of(
                    "Too many requests. Please wait " + RETRY_AFTER_SECONDS + " second(s) before retrying.",
                    HttpStatus.TOO_MANY_REQUESTS.value()));
        } catch (Exception e) {
            log.warn("failed to write 429 body for path={}", path, e);
        }
    }
}
