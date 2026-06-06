package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.JobListing;
import com.careerops.model.UserProfile;
import com.careerops.service.sources.JobSource;
import com.careerops.service.sources.ResilientJobSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Orchestrates all enabled (resilience-wrapped) JobSource implementations in parallel.
 *
 * Performance + resilience features:
 *  - Injects the "resilientSources" list (each source wrapped with circuit breaker
 *    + rate limiter + health tracking by ScraperResilienceConfig).
 *  - Uses the dedicated 'scraperExecutor' pool (sized per AsyncConfig).
 *  - Each source has an individual SOURCE_TIMEOUT_SECONDS hard deadline;
 *    a single slow/hung source cannot block the whole scrape.
 *  - Failures are isolated: one source exception never propagates to others.
 *  - Results are deduplicated before return.
 *  - Source names exposed for progress modal / health endpoint.
 */
@Service
public class JobScrapeService {

    private static final Logger log = LoggerFactory.getLogger(JobScrapeService.class);

    /**
     * Hard per-source deadline. Set to 35s so it is always wider than any
     * internal HTTP read timeout (typically 20-30s), giving the source a
     * chance to complete normally before we cancel it.
     */
    private static final int SOURCE_TIMEOUT_SECONDS = 35;

    private final List<JobSource> sources;
    private final List<JobSource> deliverySources;
    private final DeduplicationService deduplicationService;
    private final Executor scraperExecutor;

    public JobScrapeService(
            @Qualifier("resilientSources") List<JobSource> sources,
            ObjectProvider<JobSource> allSources,
            DeduplicationService deduplicationService,
            @Qualifier("scraperExecutor") Executor scraperExecutor) {
        this.sources              = sources;
        this.deliverySources      = allSources.stream()
                .filter(s -> !(s instanceof ResilientJobSource))
                .collect(Collectors.toList());
        this.deduplicationService = deduplicationService;
        this.scraperExecutor      = scraperExecutor;
    }

    /** Sources used by {@link JobDeliveryService} (profile-driven {@link Job} fetch). */
    public List<JobSource> getSources() {
        return List.copyOf(deliverySources);
    }

    public List<Job> fetchRaw(UserProfile profile) {
        if (profile == null) return List.of();
        log.info("Parallel Job fetch across {} delivery sources for userId={}",
                deliverySources.size(), profile.getUserId());

        List<CompletableFuture<List<Job>>> futures = deliverySources.stream()
                .filter(JobSource::hasBudget)
                .map(s -> {
                    long timeoutSec = s instanceof com.careerops.service.sources.company.CompanyCareerSource ? 120 : 25;
                    return CompletableFuture.supplyAsync(() -> {
                        try {
                            return s.fetch(profile);
                        } catch (Exception e) {
                            log.warn("Source '{}' failed: {}", s.sourceName(), e.getMessage());
                            return Collections.<Job>emptyList();
                        }
                    }, scraperExecutor)
                            .orTimeout(timeoutSec, TimeUnit.SECONDS)
                            .exceptionally(ex -> {
                                log.warn("Source '{}' timed out: {}", s.sourceName(), ex.getMessage());
                                return Collections.emptyList();
                            });
                })
                .toList();

        return futures.stream()
                .map(CompletableFuture::join)
                .flatMap(List::stream)
                .toList();
    }

    /**
     * Scrape all enabled sources in parallel.
     *
     * Each source is already wrapped in a ResilientJobSource (circuit breaker +
     * rate limiter).  This method adds the outer async dispatch and per-source
     * timeout so a hung source never blocks the entire scrape.
     *
     * @param keyword    job search keyword(s)
     * @param location   location filter (e.g. "Dublin", "Ireland"); empty = no filter
     * @param maxAgeDays only include jobs posted within this many days (0 = no filter)
     */
    public List<JobListing> scrapeAll(String keyword, String location, int maxAgeDays) {
        List<JobSource> enabled = sources.stream()
                .filter(JobSource::isEnabled)
                .collect(Collectors.toList());

        if (enabled.isEmpty()) {
            log.warn("scrapeAll called but no sources are enabled");
            return Collections.emptyList();
        }

        log.info("Scraping {} sources in parallel: keyword='{}' location='{}' maxAgeDays={}",
                enabled.size(), keyword, location, maxAgeDays);

        long globalStart = System.currentTimeMillis();

        // Submit all sources concurrently onto the scraperExecutor
        Map<String, Future<List<JobListing>>> futures = new LinkedHashMap<>();
        for (JobSource source : enabled) {
            futures.put(source.sourceName(),
                    CompletableFuture.supplyAsync(() -> {
                        long t = System.currentTimeMillis();
                        try {
                            List<JobListing> results = source.fetch(keyword, location, maxAgeDays);
                            log.info("[{}] {} jobs in {}ms",
                                    source.sourceName(), results.size(),
                                    System.currentTimeMillis() - t);
                            return results;
                        } catch (Exception e) {
                            log.error("[{}] failed after {}ms: {}",
                                    source.sourceName(),
                                    System.currentTimeMillis() - t, e.getMessage());
                            return Collections.<JobListing>emptyList();
                        }
                    }, scraperExecutor));
        }

        // Collect results; each future has a hard per-source deadline
        List<JobListing> all = new ArrayList<>();
        for (Map.Entry<String, Future<List<JobListing>>> entry : futures.entrySet()) {
            try {
                all.addAll(entry.getValue().get(SOURCE_TIMEOUT_SECONDS, TimeUnit.SECONDS));
            } catch (TimeoutException te) {
                log.warn("[{}] timed out after {}s — skipping",
                        entry.getKey(), SOURCE_TIMEOUT_SECONDS);
                entry.getValue().cancel(true);
            } catch (Exception e) {
                log.error("[{}] collection error: {}", entry.getKey(), e.getMessage());
            }
        }

        log.info("Scrape complete: {} raw jobs from {} sources in {}ms",
                all.size(), enabled.size(), System.currentTimeMillis() - globalStart);

        List<JobListing> deduped = deduplicationService.deduplicate(all);
        log.info("After dedup: {} unique jobs", deduped.size());
        return deduped;
    }

    /** Returns names of all enabled sources — used by the progress modal and health endpoint. */
    public List<String> getEnabledSourceNames() {
        return sources.stream()
                .filter(JobSource::isEnabled)
                .map(JobSource::sourceName)
                .collect(Collectors.toList());
    }
}
