package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.SeenJob;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SeenJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class DeduplicationService {
    private static final Logger log = LoggerFactory.getLogger(DeduplicationService.class);

    private final JobRepository     jobs;
    private final SeenJobRepository seen;

    public DeduplicationService(JobRepository jobs, SeenJobRepository seen) {
        this.jobs = jobs; this.seen = seen;
    }

    @Transactional(timeout = 10)
    public List<Job> dedupAndPersist(UUID userId, List<Job> raw) {
        List<Job> result = new ArrayList<>();
        Set<String> batch = new HashSet<>();
        for (Job j : raw) {
            if (j.getFingerprint() == null || j.getCompany() == null || j.getTitle() == null) continue;
            if (!batch.add(j.getFingerprint())) continue;
            if (seen.existsByUserIdAndFingerprint(userId, j.getFingerprint())) continue;
            Job stored = jobs.findByFingerprint(j.getFingerprint()).orElseGet(() -> jobs.save(j));
            result.add(stored);
        }
        return result;
    }

    @Transactional(timeout = 10)
    public void markSeen(UUID userId, List<Job> delivered) {
        for (Job j : delivered) {
            if (!seen.existsByUserIdAndFingerprint(userId, j.getFingerprint())) {
                seen.save(SeenJob.builder().userId(userId).fingerprint(j.getFingerprint()).build());
            }
        }
    }

    /**
     * Deletes seen_job records older than {@code keepDays} days.
     * Prevents the seen_jobs table from growing unboundedly.
     * Called by the daily cron before job delivery.
     *
     * @param keepDays how many days of seen history to retain (default: 60)
     * @return number of rows deleted
     */
    @Transactional(timeout = 10)
    public int pruneOldSeenJobs(int keepDays) {
        Instant cutoff = Instant.now().minus(keepDays, ChronoUnit.DAYS);
        int deleted = seen.deleteBySeenAtBefore(cutoff);
        if (deleted > 0) log.info("Pruned {} old seen_jobs rows (older than {} days)", deleted, keepDays);
        return deleted;
    }
}
