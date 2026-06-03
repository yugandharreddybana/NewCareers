package com.careerops.service;

import com.careerops.model.JobListing;
import com.careerops.service.sources.JobSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Orchestrates all enabled JobSource implementations in parallel.
 *
 * Performance features:
 * - Uses the dedicated 'scraperExecutor' pool (sized per AsyncConfig).
 * - Each source has an individual 30-second timeout; failures are isolated.
 * - Results are deduplicated before return.
 * - Source names exposed for progress modal.
 */
@Service
public class JobScrapeService {

    private static final Logger log = LoggerFactory.getLogger(JobScrapeService.class);
    private static final int SOURCE_TIMEOUT_SECONDS = 30;

    private final List<JobSource> sources;
    private final DeduplicationService deduplicationService;
    private final Executor scraperExecutor;

    public JobScrapeService(List<JobSource> sources,
                            DeduplicationService deduplicationService,
                            @Qualifier("scraperExecutor") Executor scraperExecutor) {
        this.sources = sources;
        this.deduplicationService = deduplicationService;
        this.scraperExecutor = scraperExecutor;
    }

    /**
     * Scrape all enabled sources in parallel.
     *
     * @param keyword    job search keyword(s)
     * @param location   location (e.g. "Dublin", "Ireland")
     * @param maxAgeDays only include jobs posted within this many days (0 = no filter)
     */
    public List<JobListing> scrapeAll(String keyword, String location, int maxAgeDays) {
        List<JobSource> enabled = sources.stream()
                .filter(JobSource::isEnabled)
                .collect(Collectors.toList());

        log.info("Scraping {} sources in parallel: keyword='{}' location='{}' maxAgeDays={}",
                enabled.size(), keyword, location, maxAgeDays);

        long globalStart = System.currentTimeMillis();

        // Submit all sources concurrently
        Map<String, Future<List<JobListing>>> futures = new LinkedHashMap<>();
        for (JobSource source : enabled) {
            futures.put(source.sourceName(), CompletableFuture.supplyAsync(() -> {
                long t = System.currentTimeMillis();
                try {
                    List<JobListing> results = source.fetch(keyword, location, maxAgeDays);
                    log.info("[{}] 🟢 {} jobs in {}ms", source.sourceName(), results.size(),
                            System.currentTimeMillis() - t);
                    return results;
                } catch (Exception e) {
                    log.error("[{}] 🔴 failed after {}ms: {}", source.sourceName(),
                            System.currentTimeMillis() - t, e.getMessage());
                    return Collections.<JobListing>emptyList();
                }
            }, scraperExecutor));
        }

        // Collect results with per-source timeout
        List<JobListing> all = new ArrayList<>();
        for (Map.Entry<String, Future<List<JobListing>>> entry : futures.entrySet()) {
            try {
                all.addAll(entry.getValue().get(SOURCE_TIMEOUT_SECONDS, TimeUnit.SECONDS));
            } catch (TimeoutException te) {
                log.warn("[{}] ⏰ timed out after {}s", entry.getKey(), SOURCE_TIMEOUT_SECONDS);
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

    /** Returns the names of all enabled sources — used by the progress modal. */
    public List<String> getEnabledSourceNames() {
        return sources.stream()
                .filter(JobSource::isEnabled)
                .map(JobSource::sourceName)
                .collect(Collectors.toList());
    }
}
