package com.careerops.service.sources;

import com.careerops.model.JobListing;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.*;

/**
 * Decorator that wraps any {@link JobSource} with:
 *
 *  1. Circuit breaker  — trips after N consecutive failures, recovers after openDuration.
 *  2. Rate limiter     — per-domain semaphore preventing concurrent request floods.
 *  3. Timeout          — each fetch is bounded by callTimeoutMs.
 *  4. Health tracking  — every call outcome is recorded in {@link SourceHealthRegistry}.
 *
 * When the circuit is OPEN the decorator returns an empty list immediately
 * so the scraping orchestrator keeps running other sources.
 */
public class ResilientJobSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(ResilientJobSource.class);

    private final JobSource              delegate;
    private final ScraperCircuitBreaker  circuitBreaker;
    private final SourceRateLimiter      rateLimiter;
    private final SourceHealthRegistry   healthRegistry;
    private final long                   callTimeoutMs;
    private final ExecutorService        callExecutor;

    public ResilientJobSource(JobSource delegate,
                               ScraperCircuitBreaker circuitBreaker,
                               SourceRateLimiter rateLimiter,
                               SourceHealthRegistry healthRegistry,
                               long callTimeoutMs,
                               ExecutorService callExecutor) {
        this.delegate       = delegate;
        this.circuitBreaker = circuitBreaker;
        this.rateLimiter    = rateLimiter;
        this.healthRegistry = healthRegistry;
        this.callTimeoutMs  = callTimeoutMs;
        this.callExecutor   = callExecutor;
    }

    @Override
    public String sourceName() { return delegate.sourceName(); }

    @Override
    public boolean isEnabled() { return delegate.isEnabled(); }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        String source = sourceName();

        // ── 1. Circuit breaker check ──────────────────────────────────
        if (!circuitBreaker.allowCall()) {
            log.warn("[{}] Circuit OPEN — skipping fetch", source);
            healthRegistry.updateCircuitState(source, circuitBreaker.getState().name());
            return Collections.emptyList();
        }

        // ── 2. Rate limiter (domain-level) ───────────────────────────
        String domain = extractDomain(source);
        boolean acquired = rateLimiter.tryAcquire(domain);
        if (!acquired) {
            log.warn("[{}] Rate limit exceeded for domain '{}' — skipping", source, domain);
            return Collections.emptyList();
        }

        // ── 3. Timed call via executor ──────────────────────────────
        try {
            Future<List<JobListing>> future = callExecutor.submit(
                    () -> delegate.fetch(keyword, location, maxAgeDays));

            List<JobListing> results = future.get(callTimeoutMs, TimeUnit.MILLISECONDS);

            // ── 4. Health update ──────────────────────────────────────
            if (results == null || results.isEmpty()) {
                // Empty is a soft failure — don't trip circuit on empty but track it
                healthRegistry.recordSuccess(source, 0);
                circuitBreaker.recordSuccess();
            } else {
                healthRegistry.recordSuccess(source, results.size());
                circuitBreaker.recordSuccess();
            }
            healthRegistry.updateCircuitState(source, circuitBreaker.getState().name());
            return results != null ? results : Collections.emptyList();

        } catch (TimeoutException te) {
            log.warn("[{}] Timed out after {}ms", source, callTimeoutMs);
            circuitBreaker.recordFailure();
            healthRegistry.recordFailure(source, "Timeout after " + callTimeoutMs + "ms");
            healthRegistry.updateCircuitState(source, circuitBreaker.getState().name());
            return Collections.emptyList();

        } catch (Exception e) {
            log.error("[{}] Fetch failed: {}", source, e.getMessage());
            circuitBreaker.recordFailure();
            healthRegistry.recordFailure(source, e.getMessage());
            healthRegistry.updateCircuitState(source, circuitBreaker.getState().name());
            return Collections.emptyList();

        } finally {
            rateLimiter.release(domain);
        }
    }

    /** Extracts a simple domain key from the source name for rate-limiter bucketing. */
    private String extractDomain(String sourceName) {
        // Try to get base domain from source name (e.g. "Adzuna" -> "adzuna",
        // "IrishJobs" -> "irishjobs"). For URL-based sources the caller
        // can override by subclassing; here we normalise the name.
        return sourceName.toLowerCase().replaceAll("\\s+", "");
    }
}
