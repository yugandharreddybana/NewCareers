package com.careerops.service.sources.company;

import com.careerops.model.Job;
import com.careerops.repository.JobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class CompanyCareerCacheService {

    private static final Logger log = LoggerFactory.getLogger(CompanyCareerCacheService.class);

    private final JobRepository jobs;

    @Value("${company.careers.cache-hours:6}")
    private int cacheHours;

    public CompanyCareerCacheService(JobRepository jobs) {
        this.jobs = jobs;
    }

    public List<Job> loadFreshJobs() {
        Instant since = Instant.now().minus(cacheHours, ChronoUnit.HOURS);
        return jobs.findBySourceNameAndScrapedAtAfter(AtsApiCompanyAdapter.SOURCE_NAME, since);
    }

    @Transactional(timeout = 30)
    public int upsertJobs(List<Job> scraped) {
        if (scraped == null || scraped.isEmpty()) {
            return 0;
        }
        int saved = 0;
        Set<String> batch = new HashSet<>();
        Instant now = Instant.now();
        for (Job j : scraped) {
            if (j.getFingerprint() == null || j.getTitle() == null || j.getCompany() == null) {
                continue;
            }
            if (!batch.add(j.getFingerprint())) {
                continue;
            }
            j.setScrapedAt(now);
            if (j.getSourceName() == null) {
                j.setSourceName(AtsApiCompanyAdapter.SOURCE_NAME);
            }
            Job stored = jobs.findByFingerprint(j.getFingerprint()).map(existing -> {
                existing.setScrapedAt(now);
                return jobs.save(existing);
            }).orElseGet(() -> jobs.save(j));
            saved++;
        }
        log.info("Company career cache upserted {} jobs", saved);
        return saved;
    }
}
