package com.careerops.service.sources.company;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.service.JobMatchingService;
import com.careerops.service.sources.JobSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;

/**
 * Tiered company career source: ATS → Playwright → Jsoup, with DB cache for fast user fetches.
 */
@Component
public class CompanyCareerSource implements JobSource {

    public static final String SOURCE_NAME = "jsoup-companies";
    private static final Logger log = LoggerFactory.getLogger(CompanyCareerSource.class);

    private final CompanyCareerRegistry registry;
    private final CompanyCareerFetcher fetcher;
    private final CompanyCareerCacheService cache;
    private final JobMatchingService matcher;
    private final ExecutorService executor = Executors.newFixedThreadPool(6);

    public CompanyCareerSource(
            CompanyCareerRegistry registry,
            CompanyCareerFetcher fetcher,
            CompanyCareerCacheService cache,
            JobMatchingService matcher) {
        this.registry = registry;
        this.fetcher = fetcher;
        this.cache = cache;
        this.matcher = matcher;
    }

    @Override
    public String name() {
        return SOURCE_NAME;
    }

    /** Fast path for onboarding/background scrape — reads cached company jobs only. */
    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> cached = cache.loadFreshJobs();
        log.info("Company career cache returned {} jobs", cached.size());
        return cached;
    }

    /**
     * Best profile-matched role per company. Used by POST /jobs/fetch (120s budget).
     */
    public List<Job> fetchProfileMatches(UserProfile profile, int minPct) {
        List<Job> pool = cache.loadFreshJobs();
        if (pool.isEmpty()) {
            log.info("Company career cache cold — running full scan");
            pool = scanAllCompanies();
        }
        return bestMatchPerCompany(pool, profile, minPct);
    }

    /** Full scan of all registered companies; upserts into jobs cache. */
    public List<Job> scanAllCompanies() {
        List<CompanyCareerRegistry.Entry> entries = registry.all();
        List<CompletableFuture<CompanyCareerFetcher.FetchResult>> futures = entries.stream()
            .map(e -> CompletableFuture.supplyAsync(() -> fetcher.fetchCompany(e), executor)
                .orTimeout(90, TimeUnit.SECONDS)
                .exceptionally(ex -> new CompanyCareerFetcher.FetchResult(
                    e.name(), "error", List.of(), 0)))
            .toList();

        List<Job> all = new ArrayList<>();
        for (CompletableFuture<CompanyCareerFetcher.FetchResult> f : futures) {
            CompanyCareerFetcher.FetchResult r = f.join();
            all.addAll(r.jobs());
        }
        cache.upsertJobs(all);
        log.info("Company career scan complete: {} jobs from {} companies", all.size(), entries.size());
        return all;
    }

    private List<Job> bestMatchPerCompany(List<Job> jobs, UserProfile profile, int minPct) {
        if (jobs.isEmpty()) {
            return List.of();
        }
        Map<String, List<Job>> byCompany = new LinkedHashMap<>();
        for (Job j : jobs) {
            String key = j.getCompany() == null ? "Unknown" : j.getCompany().trim();
            byCompany.computeIfAbsent(key, k -> new ArrayList<>()).add(j);
        }

        List<Job> out = new ArrayList<>();
        for (Map.Entry<String, List<Job>> row : byCompany.entrySet()) {
            List<JobMatchingService.ScoredJob> ranked = matcher.topN(row.getValue(), profile, 1);
            if (ranked.isEmpty()) {
                continue;
            }
            JobMatchingService.ScoredJob best = ranked.get(0);
            if (minPct > 0 && best.score() < minPct) {
                continue;
            }
            out.add(best.job());
        }
        return out;
    }
}
