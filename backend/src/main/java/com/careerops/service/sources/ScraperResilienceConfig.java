package com.careerops.service.sources;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Wires every registered concrete {@link JobSource} implementation into a
 * {@link ResilientJobSource} decorator at startup.
 *
 * Spring injection strategy
 * ─────────────────────────
 * We use {@link ObjectProvider} instead of {@code List<JobSource>} to collect
 * raw source beans.  A plain {@code List<JobSource>} injection would resolve to
 * the @Primary bean produced by this very config, causing a
 * BeanCurrentlyInCreationException.  ObjectProvider lets us stream ALL beans of
 * the type and filter out any that are already ResilientJobSource wrappers.
 *
 * The resulting wrapped list is registered as bean "resilientSources" and is
 * injected into {@link com.careerops.service.JobScrapeService} via
 * {@code @Qualifier("resilientSources")}.
 *
 * Timeout ownership
 * ─────────────────
 * Timeout enforcement is owned entirely by JobScrapeService (CompletableFuture
 * + SOURCE_TIMEOUT_SECONDS).  ResilientJobSource calls delegate.fetch() directly
 * without a nested executor or future so there is no double-timeout problem.
 *
 * Configuration (application.properties):
 *   scraper.resilience.failure-threshold      consecutive failures before OPEN  (default 5)
 *   scraper.resilience.open-duration-ms       how long circuit stays OPEN       (default 120000 = 2 min)
 *   scraper.resilience.success-threshold      successes in HALF_OPEN to recover  (default 2)
 *   scraper.resilience.max-concurrent-domain  max concurrent calls per domain    (default 3)
 *   scraper.resilience.rate-limit-timeout-ms  wait for rate-limit permit ms      (default 5000 = 5s)
 */
@Configuration
public class ScraperResilienceConfig {

    private static final Logger log = LoggerFactory.getLogger(ScraperResilienceConfig.class);

    @Value("${scraper.resilience.failure-threshold:5}")
    private int failureThreshold;

    @Value("${scraper.resilience.open-duration-ms:120000}")
    private long openDurationMs;

    @Value("${scraper.resilience.success-threshold:2}")
    private int successThreshold;

    @Value("${scraper.resilience.max-concurrent-domain:3}")
    private int maxConcurrentPerDomain;

    @Value("${scraper.resilience.rate-limit-timeout-ms:5000}")
    private long rateLimitTimeoutMs;

    /** Shared per-domain semaphore rate limiter — one instance used by all wrappers. */
    @Bean
    public SourceRateLimiter sourceRateLimiter() {
        return new SourceRateLimiter(maxConcurrentPerDomain, rateLimitTimeoutMs);
    }

    /**
     * Produces the list of wrapped sources under the qualifier "resilientSources".
     *
     * ObjectProvider streams ALL JobSource beans registered in the context.
     * We filter out any that are already ResilientJobSource (safety guard against
     * double-wrapping if this method were ever called twice) and wrap each raw
     * source with its own ScraperCircuitBreaker + shared SourceRateLimiter.
     */
    @Bean(name = "resilientSources")
    public List<JobSource> resilientSources(
            ObjectProvider<JobSource> allSources,
            SourceHealthRegistry healthRegistry,
            SourceRateLimiter sourceRateLimiter) {

        List<JobSource> wrapped = allSources.stream()
                .filter(s -> !(s instanceof ResilientJobSource))
                .map(raw -> {
                    ScraperCircuitBreaker cb = new ScraperCircuitBreaker(
                            raw.name(), failureThreshold, openDurationMs, successThreshold);
                    log.info("[ResilienceConfig] Wrapping '{}' — failThreshold={} openDurationMs={}",
                            raw.name(), failureThreshold, openDurationMs);
                    return (JobSource) new ResilientJobSource(
                            raw, cb, sourceRateLimiter, healthRegistry);
                })
                .collect(Collectors.toList());

        log.info("[ResilienceConfig] {} sources wrapped with circuit breaker + rate limiter",
                wrapped.size());
        return wrapped;
    }
}
