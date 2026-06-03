package com.careerops.service.sources;

import com.careerops.model.JobListing;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.List;

/**
 * Decorator that wraps any {@link JobSource} with:
 *
 *  1. Circuit breaker  — trips after N consecutive failures, recovers after openDuration.
 *  2. Rate limiter     — per-domain semaphore preventing concurrent request floods.
 *  3. Health tracking  — every call outcome is recorded in {@link SourceHealthRegistry}.
 *
 * Timeout enforcement is intentionally NOT done here.  JobScrapeService wraps
 * every source call in a CompletableFuture with its own SOURCE_TIMEOUT_SECONDS
 * deadline.  A second nested timeout would cause double-blocking on two different
 * thread pools and waste threads — Bug 2 from the post-push audit.
 *
 * When the circuit is OPEN the decorator returns an empty list immediately
 * so the scraping orchestrator continues running all other sources unaffected.
 */
public class ResilientJobSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(ResilientJobSource.class);

    private final JobSource             delegate;
    private final ScraperCircuitBreaker circuitBreaker;
    private final SourceRateLimiter     rateLimiter;
    private final SourceHealthRegistry  healthRegistry;

    public ResilientJobSource(JobSource delegate,
                               ScraperCircuitBreaker circuitBreaker,
                               SourceRateLimiter rateLimiter,
                               SourceHealthRegistry healthRegistry) {
        this.delegate       = delegate;
        this.circuitBreaker = circuitBreaker;
        this.rateLimiter    = rateLimiter;
        this.healthRegistry = healthRegistry;
    }

    @Override
    public String sourceName() { return delegate.sourceName(); }

    @Override
    public boolean isEnabled() { return delegate.isEnabled(); }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        String source = sourceName();

        // ── 1. Circuit breaker check ──────────────────────────────────────────────
        if (!circuitBreaker.allowCall()) {
            log.warn("[{}] Circuit OPEN — skipping fetch", source);
            healthRegistry.updateCircuitState(source, circuitBreaker.getState().name());
            return Collections.emptyList();
        }

        // ── 2. Rate limiter (per-domain semaphore) ────────────────────────────────
        String domain = extractDomain(source);
        if (!rateLimiter.tryAcquire(domain)) {
            log.warn("[{}] Rate limit exceeded for domain '{}' — skipping", source, domain);
            // Do NOT record as circuit-breaker failure — this is a local concurrency
            // limit, not a remote service failure.
            return Collections.emptyList();
        }

        // ── 3. Delegate call (timeout owned by JobScrapeService) ──────────────────
        try {
            List<JobListing> results = delegate.fetch(keyword, location, maxAgeDays);

            // ── 4. Health + circuit update ────────────────────────────────────────
            int count = (results == null) ? 0 : results.size();
            healthRegistry.recordSuccess(source, count);
            circuitBreaker.recordSuccess();
            healthRegistry.updateCircuitState(source, circuitBreaker.getState().name());

            return results != null ? results : Collections.emptyList();

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

    /**
     * Maps a source name to a stable domain key for rate-limiter bucketing.
     * e.g. "Adzuna" -> "adzuna", "Irish Jobs" -> "irishjobs"
     */
    private String extractDomain(String sourceName) {
        return sourceName.toLowerCase().replaceAll("\\s+", "");
    }
}
