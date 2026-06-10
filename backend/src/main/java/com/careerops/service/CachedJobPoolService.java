package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Loads candidate jobs from the canonical {@code careerops.jobs} pool only — no external HTTP.
 */
@Service
public class CachedJobPoolService {

    private static final Logger log = LoggerFactory.getLogger(CachedJobPoolService.class);

    private final JobRepository jobs;
    private final JobFetchSettings fetchSettings;
    private final Clock clock;

    public CachedJobPoolService(JobRepository jobs, JobFetchSettings fetchSettings, Clock clock) {
        this.jobs = jobs;
        this.fetchSettings = fetchSettings;
        this.clock = clock;
    }

    @Transactional(readOnly = true, timeout = 15)
    public List<Job> loadCandidates(UserProfile profile, int maxCandidates) {
        if (profile == null) {
            return List.of();
        }
        int cap = Math.max(1, maxCandidates);
        Instant cutoff = clock.instant().minus(fetchSettings.maxAgeDays(), ChronoUnit.DAYS);

        List<Job> recent = jobs.findRecentByScrapedAtAfter(cutoff, PageRequest.of(0, cap));
        if (recent.isEmpty()) {
            log.info("Cached job pool empty for cutoff={}", cutoff);
            return List.of();
        }

        List<String> keywords = JobProfileSearchTerms.searchKeywords(profile);
        List<Job> keywordMatched = filterByKeywords(recent, keywords);
        if (keywordMatched.isEmpty()) {
            log.info("Cached job pool: no keyword matches from {} recent rows (keywords={})",
                    recent.size(), keywords);
            return List.of();
        }

        boolean sparseProfile = profile.getTargetRoles() == null || profile.getTargetRoles().length == 0;
        List<Job> filtered = sparseProfile
                ? JobDeliveryFilters.applyPipelineFiltersRelaxed(
                        keywordMatched, fetchSettings.maxAgeDays(), profile)
                : JobDeliveryFilters.applyPipelineFilters(
                        keywordMatched, fetchSettings.maxAgeDays(), profile);

        log.info("Cached job pool: {} recent → {} keyword → {} after pipeline filters (sparse={})",
                recent.size(), keywordMatched.size(), filtered.size(), sparseProfile);
        return filtered;
    }

    static List<Job> filterByKeywords(List<Job> jobs, List<String> keywords) {
        if (jobs == null || jobs.isEmpty() || keywords == null || keywords.isEmpty()) {
            return List.of();
        }
        List<Job> out = new ArrayList<>();
        for (Job job : jobs) {
            if (job == null) continue;
            if (matchesAnyKeyword(job, keywords)) {
                out.add(job);
            }
        }
        return out;
    }

    private static boolean matchesAnyKeyword(Job job, List<String> keywords) {
        String haystack = ((job.getTitle() != null ? job.getTitle() : "") + " "
                + (job.getDescription() != null ? job.getDescription() : "")).toLowerCase(Locale.ROOT);
        for (String keyword : keywords) {
            if (keyword == null || keyword.isBlank()) continue;
            if (haystack.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }
}
