package com.careerops.service.sources;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Per-domain token-bucket rate limiter.
 *
 * Prevents hammering any single job board host during parallel scraping.
 * Each domain gets a semaphore with a fixed number of permits.
 * A permit is acquired before a call and released immediately after,
 * effectively bounding concurrent requests per domain.
 *
 * Usage:
 *   if (!rateLimiter.tryAcquire(domain, timeoutMs)) {
 *       // domain is at capacity, skip or queue
 *   }
 *   try { ... fetch ... } finally { rateLimiter.release(domain); }
 */
public class SourceRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(SourceRateLimiter.class);

    private final int maxConcurrentPerDomain;
    private final long acquireTimeoutMs;
    private final ConcurrentHashMap<String, Semaphore> domainSemaphores = new ConcurrentHashMap<>();

    public SourceRateLimiter(int maxConcurrentPerDomain, long acquireTimeoutMs) {
        this.maxConcurrentPerDomain = maxConcurrentPerDomain;
        this.acquireTimeoutMs       = acquireTimeoutMs;
    }

    /**
     * Attempt to acquire a slot for the given domain.
     * Returns true if acquired (caller MUST call release), false if timed out.
     */
    public boolean tryAcquire(String domain) {
        Semaphore sem = domainSemaphores.computeIfAbsent(domain,
                k -> new Semaphore(maxConcurrentPerDomain, true));
        try {
            boolean acquired = sem.tryAcquire(acquireTimeoutMs, TimeUnit.MILLISECONDS);
            if (!acquired) {
                log.warn("[RateLimiter] domain='{}' at capacity ({}), skipping", domain, maxConcurrentPerDomain);
            }
            return acquired;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /** Release a previously acquired slot for the domain. */
    public void release(String domain) {
        Semaphore sem = domainSemaphores.get(domain);
        if (sem != null) sem.release();
    }

    /** Current available permits for a domain (for monitoring). */
    public int availablePermits(String domain) {
        Semaphore sem = domainSemaphores.get(domain);
        return sem == null ? maxConcurrentPerDomain : sem.availablePermits();
    }
}
