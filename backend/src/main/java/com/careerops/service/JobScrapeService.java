package com.careerops.service;

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

@Service
public class JobScrapeService {
    private static final Logger log = LoggerFactory.getLogger(JobScrapeService.class);

    private final List<JobSource> sources;

    public JobScrapeService(IrishJobsSource irish, JobsIeSource jobsIe,
                            JsoupCompanySource companies,
                            RemotiveSource rm, TheMuseSource tm,
                            JobicySource jb, RssSource rs,
                            ReedSource r, AdzunaSource a,
                            TwinAiSource twin) {
        // Order: free/scraper sources first, budgeted API sources next, Twin AI last
        this.sources = List.of(irish, jobsIe, companies, rm, tm, jb, rs, r, a, twin);
    }

    public List<Job> fetchRaw(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        for (JobSource s : sources) {
            if (!s.hasBudget()) { log.info("Skipping '{}' (budget/disabled)", s.name()); continue; }
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

    private List<Job> applyFreshness(List<Job> jobs, UserProfile profile) {
        int hours = profile.getFreshnessHours() == null ? 96 : profile.getFreshnessHours();
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        return jobs.stream()
            .filter(j -> j.getPostedAt() == null || j.getPostedAt().isAfter(cutoff))
            .toList();
    }
}
