package com.careerops.service.sources;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Wires every registered {@link JobSource} into a {@link ResilientJobSource} decorator.
 *
 * Configuration (application.properties):
 *   scraper.resilience.failure-threshold      consecutive failures before OPEN  (default 5)
 *   scraper.resilience.open-duration-ms       how long circuit stays OPEN       (default 120000 = 2 min)
 *   scraper.resilience.success-threshold      successes in HALF_OPEN to recover  (default 2)
 *   scraper.resilience.call-timeout-ms        per-source call timeout            (default 30000 = 30s)
 *   scraper.resilience.max-concurrent-domain  max concurrent calls per domain    (default 3)
 *   scraper.resilience.rate-limit-timeout-ms  wait for rate-limit permit         (default 5000 = 5s)
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

    @Value("${scraper.resilience.call-timeout-ms:30000}")
    private long callTimeoutMs;

    @Value("${scraper.resilience.max-concurrent-domain:3}")
    private int maxConcurrentPerDomain;

    @Value("${scraper.resilience.rate-limit-timeout-ms:5000}")
    private long rateLimitTimeoutMs;

    /**
     * Shared rate limiter across all sources (per-domain bucketing).
     */
    @Bean
    public SourceRateLimiter sourceRateLimiter() {
        return new SourceRateLimiter(maxConcurrentPerDomain, rateLimitTimeoutMs);
    }

    /**
     * A small dedicated executor for timed source calls inside ResilientJobSource.
     * Uses a cached pool (short-lived, bounded by scraperExecutor upstream).
     */
    @Bean(name = "resilientCallExecutor")
    public ExecutorService resilientCallExecutor() {
        return Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "resilient-call");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Wraps every raw JobSource bean with the resilience decorator.
     * The original beans are replaced in the Spring context with their
     * ResilientJobSource wrappers, keeping the rest of the code unchanged.
     *
     * Spring injects the raw sources here (before this config runs) via
     * the unqualified List<JobSource> — the @Primary qualifier prevents
     * circular injection.
     */
    @Bean
    @Primary
    public List<JobSource> resilientJobSources(
            List<JobSource> rawSources,
            SourceHealthRegistry healthRegistry,
            SourceRateLimiter sourceRateLimiter,
            @Qualifier("resilientCallExecutor") ExecutorService callExecutor) {

        List<JobSource> wrapped = rawSources.stream()
                .filter(s -> !(s instanceof ResilientJobSource)) // avoid double-wrapping
                .map(raw -> {
                    ScraperCircuitBreaker cb = new ScraperCircuitBreaker(
                            raw.sourceName(), failureThreshold, openDurationMs, successThreshold);
                    log.info("Resilience wrapping: {} (failThreshold={} openDuration={}ms timeout={}ms)",
                            raw.sourceName(), failureThreshold, openDurationMs, callTimeoutMs);
                    return (JobSource) new ResilientJobSource(
                            raw, cb, sourceRateLimiter, healthRegistry, callTimeoutMs, callExecutor);
                })
                .collect(Collectors.toList());

        log.info("ScraperResilienceConfig: wrapped {} sources with circuit breaker + rate limiter",
                wrapped.size());
        return wrapped;
    }
}
