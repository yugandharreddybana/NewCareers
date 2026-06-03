package com.careerops.service;

import com.careerops.model.JobListing;
import com.careerops.service.sources.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Orchestrates ALL job sources in parallel.
 * Every source that implements JobSource is injected automatically via the
 * Spring-managed list. Sources are fired concurrently; results are merged,
 * de-duplicated and returned.
 */
@Service
public class JobScrapeService {

    private static final Logger log = LoggerFactory.getLogger(JobScrapeService.class);
    private static final int THREAD_POOL = 16;
    private static final int TIMEOUT_SECONDS = 30;

    private final List<JobSource> sources;
    private final DeduplicationService deduplicationService;
    private final ExecutorService executor;

    public JobScrapeService(List<JobSource> sources,
                            DeduplicationService deduplicationService) {
        this.sources = sources;
        this.deduplicationService = deduplicationService;
        this.executor = Executors.newFixedThreadPool(THREAD_POOL,
                r -> { Thread t = new Thread(r, "job-scraper"); t.setDaemon(true); return t; });
    }

    /**
     * Scrape all enabled sources in parallel.
     *
     * @param keyword    job search keyword
     * @param location   location string (e.g. "Dublin", "Ireland")
     * @param maxAgeDays only include jobs posted within this many days (0 = no filter)
     * @return merged, de-duplicated list of job listings
     */
    public List<JobListing> scrapeAll(String keyword, String location, int maxAgeDays) {
        List<JobSource> enabled = sources.stream()
                .filter(JobSource::isEnabled)
                .collect(Collectors.toList());

        log.info("Scraping {} sources in parallel for '{}' / '{}' (maxAgeDays={})",
                enabled.size(), keyword, location, maxAgeDays);

        List<Future<List<JobListing>>> futures = new ArrayList<>();
        for (JobSource source : enabled) {
            futures.add(executor.submit(() -> {
                try {
                    List<JobListing> results = source.fetch(keyword, location, maxAgeDays);
                    log.info("[{}] fetched {} jobs", source.sourceName(), results.size());
                    return results;
                } catch (Exception e) {
                    log.error("[{}] unexpected error during fetch: {}", source.sourceName(), e.getMessage());
                    return Collections.<JobListing>emptyList();
                }
            }));
        }

        List<JobListing> all = new ArrayList<>();
        for (Future<List<JobListing>> future : futures) {
            try {
                all.addAll(future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS));
            } catch (TimeoutException te) {
                log.warn("A scraper timed out after {}s", TIMEOUT_SECONDS);
            } catch (Exception e) {
                log.error("Error collecting scraper result", e);
            }
        }

        List<JobListing> deduped = deduplicationService.deduplicate(all);
        log.info("Total after dedup: {}", deduped.size());
        return deduped;
    }

    /** Returns the names of all enabled sources – used by the progress modal. */
    public List<String> getEnabledSourceNames() {
        return sources.stream()
                .filter(JobSource::isEnabled)
                .map(JobSource::sourceName)
                .collect(Collectors.toList());
    }
}
