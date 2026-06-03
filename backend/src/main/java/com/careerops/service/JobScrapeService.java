package com.careerops.service;

import com.careerops.dto.SearchParams;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.service.sources.*;
import com.careerops.service.sources.company.CompanyCareerSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.*;
import jakarta.annotation.PreDestroy;

/**
 * Section 7 — Task 67
 * Orchestrates all JobSource implementations using the Strategy pattern.
 *
 * fetchRaw(profile)       — background parallel scrape across all sources
 * search(params, profile) — on-demand keyword search across sources that support it
 *
 * Sources registered (16 total):
 *   Free/no-key:  IrishJobsSource, JobsIeSource, JobsIrelandSource,
 *                 LinkedInPublicSource, JsoupCompanySource,
 *                 RemotiveSource, TheMuseSource, JobicySource, RssSource,
 *                 WeWorkRemotelySource, EuroJobsSource, TwinAiSource
 *   API-key:      ReedSource, AdzunaSource
 *   On-demand:    SerpApiJobSource, IndeedRssSource
 *
 * All sources are fail-safe: exceptions and timeouts return empty list.
 * Thread pool: 10 threads to accommodate the expanded source list.
 */
@Service
public class JobScrapeService {

    private static final Logger log = LoggerFactory.getLogger(JobScrapeService.class);

    private final List<JobSource> sources;
    private final ExecutorService executor = Executors.newFixedThreadPool(10);

    @Value("${jobs.freshness.default.hours:96}")
    private int defaultFreshnessHours;

    public JobScrapeService(
            IrishJobsSource irish, JobsIeSource jobsIe,
            JobsIrelandSource jobsIreland, LinkedInPublicSource linkedIn,
            CompanyCareerSource companies,
            RemotiveSource rm, TheMuseSource tm,
            JobicySource jb, RssSource rs,
            ReedSource r, AdzunaSource a,
            TwinAiSource twin,
            SerpApiJobSource serp,
            IndeedRssSource indeed,
            WeWorkRemotelySource wwr,
            EuroJobsSource euro) {
        // Order: Irish-focused sources first, then general free/no-key,
        // API-key sources next, on-demand search sources last (serp, indeed)
        this.sources = List.of(
            irish, jobsIe, jobsIreland, linkedIn, companies,
            rm, tm, jb, rs,
            wwr, euro,
            r, a, twin,
            serp, indeed
        );
    }

    // ── Background scrape ────────────────────────────────────────────────────

    public List<Job> fetchRaw(UserProfile profile) {
        log.info("Starting parallel fetch across {} sources for userId={}",
                sources.size(), profile.getUserId());

        List<CompletableFuture<List<Job>>> futures = sources.stream()
            .filter(JobSource::hasBudget)
            .map(s -> {
                long timeoutSec = s instanceof CompanyCareerSource ? 120 : 25;
                return CompletableFuture.supplyAsync(() -> {
                    try {
                        return s.fetch(profile);
                    } catch (Exception e) {
                        log.warn("Source '{}' failed: {}", s.name(), e.getMessage());
                        return Collections.<Job>emptyList();
                    }
                }, executor).orTimeout(timeoutSec, TimeUnit.SECONDS).exceptionally(ex -> {
                    log.warn("Source '{}' timed out or failed: {}", s.name(), ex.getMessage());
                    return Collections.emptyList();
                });
            })
            .toList();

        List<Job> allJobs = futures.stream()
            .map(CompletableFuture::join)
            .flatMap(List::stream)
            .toList();

        List<Job> fresh = applyFreshness(allJobs, profile);
        log.info("Total collected: {}. After freshness filter: {}/{}",
                allJobs.size(), fresh.size(), allJobs.size());
        return fresh;
    }

    // ── On-demand search ──────────────────────────────────────────────────────

    public List<Job> search(SearchParams params, UserProfile profile) {
        log.info("Starting parallel search across {} sources for query='{}'",
                sources.size(), params.toSearchQuery());

        List<CompletableFuture<List<Job>>> futures = sources.stream()
            .filter(JobSource::hasBudget)
            .map(s -> CompletableFuture.supplyAsync(() -> {
                try {
                    return s.search(params, profile);
                } catch (com.careerops.exception.ApiException apiEx) {
                    throw apiEx;
                } catch (Exception e) {
                    log.warn("Search source '{}' failed: {}", s.name(), e.getMessage());
                    return Collections.<Job>emptyList();
                }
            }, executor).orTimeout(25, TimeUnit.SECONDS).exceptionally(ex -> {
                log.warn("Search source '{}' timed out or failed: {}", s.name(), ex.getMessage());
                return Collections.emptyList();
            }))
            .toList();

        List<Job> results = futures.stream()
            .map(CompletableFuture::join)
            .flatMap(List::stream)
            .toList();

        log.info("On-demand search total: {} results", results.size());
        return results;
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down JobScrapeService executor...");
        executor.shutdown();
    }

    /** All registered scrape/search sources (order preserved). */
    public List<JobSource> getSources() {
        return List.copyOf(sources);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private List<Job> applyFreshness(List<Job> jobs, UserProfile profile) {
        int hours = profile.getFreshnessHours() == null
                ? defaultFreshnessHours : profile.getFreshnessHours();
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        return jobs.stream()
                .filter(j -> j.getPostedAt() == null || j.getPostedAt().isAfter(cutoff))
                .toList();
    }
}
