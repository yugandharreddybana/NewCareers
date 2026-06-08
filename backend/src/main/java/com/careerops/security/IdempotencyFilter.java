package com.careerops.security;

import com.careerops.billing.BillingWebhookIdempotency;
import com.careerops.model.IdempotencyKey;
import com.careerops.repository.IdempotencyRepository;
import com.careerops.util.AuthUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Issue 2.047 — Idempotency-Key support for POST endpoints.
 * Prevents double-processing of requests by caching the response for a given key.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IdempotencyFilter extends OncePerRequestFilter {

    private final IdempotencyRepository repository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = request.getHeader("Idempotency-Key");
        if (key == null || key.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        if (key.startsWith(BillingWebhookIdempotency.STORAGE_KEY_PREFIX)) {
            log.warn("Rejected client idempotency key using reserved Stripe webhook prefix");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Idempotency-Key uses a reserved prefix\"}");
            return;
        }

        // We need the userId, but the InternalTrustFilter might not have run yet if we are before it.
        // In SecurityConfig, we should place this AFTER InternalTrustFilter.
        UUID userId;
        try {
            userId = AuthUtil.currentUserId();
        } catch (Exception e) {
            // If we can't get userId, we can't safely scope the idempotency key.
            filterChain.doFilter(request, response);
            return;
        }

        var existing = repository.findByIdempotencyKeyAndUserId(key, userId);
        if (existing.isPresent()) {
            IdempotencyKey ik = existing.get();
            if (ik.getExpiresAt().isAfter(Instant.now())) {
                log.info("Idempotency hit for key={} userId={}", key, userId);
                response.setStatus(ik.getResponseStatus());
                response.setContentType("application/json");
                response.getWriter().write(ik.getResponseBody());
                response.addHeader("X-Idempotency-Cache", "HIT");
                return;
            } else {
                repository.delete(ik);
            }
        }

        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        try {
            filterChain.doFilter(request, wrappedResponse);
        } finally {
            int status = wrappedResponse.getStatus();
            // Only cache successful or non-server-error responses (2xx, 4xx)
            if (status >= 200 && status < 500) {
                String responseBody = new String(wrappedResponse.getContentAsByteArray(), wrappedResponse.getCharacterEncoding());
                repository.save(IdempotencyKey.builder()
                        .idempotencyKey(key)
                        .userId(userId)
                        .requestPath(request.getRequestURI())
                        .responseStatus(status)
                        .responseBody(responseBody)
                        .expiresAt(Instant.now().plus(24, ChronoUnit.HOURS))
                        .build());
            }
            wrappedResponse.copyBodyToResponse();
        }
    }
}
