package com.careerops.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Servlet filter that:
 * 1. Assigns a unique correlationId to every request (MDC + response header).
 * 2. Logs method, URI, status code, and elapsed ms at the end of each request.
 * 3. Cleans up MDC after the request to prevent thread-local leaks.
 */
@Component
@Order(1)
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String correlationId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        MDC.put("correlationId", correlationId);

        // Extract userId from JWT claims header if already decoded by security filter
        String userId = request.getHeader("X-User-Id");
        if (userId != null) MDC.put("userId", userId);

        response.setHeader("X-Correlation-Id", correlationId);
        long start = System.currentTimeMillis();

        try {
            chain.doFilter(request, response);
        } finally {
            long elapsed = System.currentTimeMillis() - start;
            int status = response.getStatus();
            // Log only non-actuator calls to avoid noise
            if (!request.getRequestURI().contains("/actuator")) {
                if (status >= 500) {
                    log.error("{} {} -> {} ({}ms)", request.getMethod(), request.getRequestURI(), status, elapsed);
                } else if (status >= 400) {
                    log.warn("{} {} -> {} ({}ms)", request.getMethod(), request.getRequestURI(), status, elapsed);
                } else {
                    log.info("{} {} -> {} ({}ms)", request.getMethod(), request.getRequestURI(), status, elapsed);
                }
            }
            MDC.clear();
        }
    }
}
