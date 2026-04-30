package com.careerops.service;

import com.careerops.dto.SearchParams;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.service.sources.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Section 7 — Task 67
 * Orchestrates all JobSource implementations using the Strategy pattern.
 *
 * fetchRaw(profile)   — background scrape across all sources
 * search(params, profile) — on-demand keyword search across sources that support it
 *                           (SerpApiJobSource, IndeedRssSource override search())
 */
@Service
public class JobScrapeService {

    private static final Logger log = LoggerFactory.getLogger(JobScrapeService.class);

    private final List<JobSource> sources;

    public JobScrapeService(
            IrishJobsSource irish, JobsIeSource jobsIe,
            JsoupCompanySource companies,
            RemotiveSource rm, TheMuseSource tm,
            JobicySource jb, RssSource rs,
            ReedSource r, AdzunaSource a,
            TwinAiSource twin,
            SerpApiJobSource serp,
            IndeedRssSource indeed) {
        // Order: free/scraper sources first, budgeted API sources next,
        // on-demand search sources last (serp, indeed)
        this.sources = List.of(
            irish, jobsIe, companies, rm, tm,
            jb, rs, r, a, twin, serp, indeed
        );
    }

    // ── Background scrape (unchanged from Phase 1) ───────────────────────────────

    public List<Job> fetchRaw(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        for (JobSource s : sources) {
            if (!s.hasBudget()) {
                log.info("Skipping '{}' (budget/disabled)", s.name());
                continue;
            }
            try {
                List<Job> got = s.fetch(profile);
                log.info("Source '{}' returned {} jobs", s.name(), got.size());
                out.addAll(got);
            } catch (Exception e) {
                log.warn("Source '{}' failed: {}", s.name(), e.getMessage());
            }
        }
        List<Job> fresh = applyFreshness(out, profile);
        log.info("Total after freshness filter: {}/{}", fresh.size(), out.size());
        return fresh;
    }

    // ── On-demand search (Section 7) ─────────────────────────────────────────

    /**
     * Calls search(SearchParams, UserProfile) on every source that supports it.
     * Background-only sources return empty list and are silently skipped.
     * Results are aggregated and returned unsorted (caller handles ranking).
     */
    public List<Job> search(SearchParams params, UserProfile profile) {
        List<Job> out = new ArrayList<>();
        for (JobSource s : sources) {
            if (!s.hasBudget()) continue;
            try {
                List<Job> got = s.search(params, profile);
                if (!got.isEmpty()) {
                    log.info("Search source '{}' returned {} jobs", s.name(), got.size());
                    out.addAll(got);
                }
            } catch (Exception e) {
                log.warn("Search source '{}' failed: {}", s.name(), e.getMessage());
            }
        }
        log.info("On-demand search total: {} results for query='{}'",
                 out.size(), params.toSearchQuery());
        return out;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private List<Job> applyFreshness(List<Job> jobs, UserProfile profile) {
        int hours = profile.getFreshnessHours() == null ? 96 : profile.getFreshnessHours();
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        return jobs.stream()
                .filter(j -> j.getPostedAt() == null || j.getPostedAt().isAfter(cutoff))
                .toList();
    }
}
