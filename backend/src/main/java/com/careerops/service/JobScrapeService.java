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

    public JobScrapeService(AdzunaSource a, ReedSource r, RemotiveSource rm, TheMuseSource tm,
                            JobicySource jb, RssSource rs, JsoupCompanySource js) {
        this.sources = List.of(rm, tm, jb, rs, js, r, a); // free first, budgeted last
    }

    public List<Job> fetchRaw(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        for (JobSource s : sources) {
            if (!s.hasBudget()) { log.info("Skipping {} (budget)", s.name()); continue; }
            try {
                List<Job> got = s.fetch(profile);
                log.info("Source {} returned {} jobs", s.name(), got.size());
                out.addAll(got);
            } catch (Exception e) {
                log.warn("Source {} failed: {}", s.name(), e.getMessage());
            }
        }
        return applyFreshness(out, profile);
    }

    private List<Job> applyFreshness(List<Job> jobs, UserProfile profile) {
        int hours = profile.getFreshnessHours() == null ? 96 : profile.getFreshnessHours();
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        return jobs.stream()
            .filter(j -> j.getPostedAt() == null || j.getPostedAt().isAfter(cutoff))
            .toList();
    }
}
