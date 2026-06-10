package com.careerops.service;

import com.careerops.debug.DebugSessionLog;
import com.careerops.model.Job;
import com.careerops.model.JobListing;
import com.careerops.model.SeenJob;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SeenJobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.service.sources.FingerprintUtil;
import com.careerops.service.sources.JobPostingFingerprint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DeduplicationService {

    private static final Logger log = LoggerFactory.getLogger(DeduplicationService.class);
    private static final int MAX_INPUT_SIZE = 5_000;

    private final JobRepository     jobs;
    private final SeenJobRepository seen;
    private final UserJobRepository userJobs;

    public DeduplicationService(JobRepository jobs, SeenJobRepository seen, UserJobRepository userJobs) {
        this.jobs = jobs;
        this.seen = seen;
        this.userJobs = userJobs;
    }

    public List<JobListing> deduplicate(List<JobListing> listings) {
        if (listings == null || listings.isEmpty()) return Collections.emptyList();

        List<JobListing> input = listings.size() > MAX_INPUT_SIZE ? listings.subList(0, MAX_INPUT_SIZE) : listings;
        if (listings.size() > MAX_INPUT_SIZE) {
            log.warn("DeduplicationService: input capped from {} to {}", listings.size(), MAX_INPUT_SIZE);
        }

        ConcurrentHashMap<String, Boolean> seenFp = new ConcurrentHashMap<>(input.size() * 2);
        List<JobListing> unique = new ArrayList<>(input.size());

        for (JobListing job : input) {
            String fp = JobPostingFingerprint.fingerprint(
                    job.getTitle()   != null ? job.getTitle()   : "",
                    job.getCompany() != null ? job.getCompany() : "",
                    job.getUrl()     != null ? job.getUrl()     : "");
            if (seenFp.putIfAbsent(fp, Boolean.TRUE) == null) {
                unique.add(job);
            }
        }

        log.info("Dedup: {} → {} unique listings", input.size(), unique.size());
        return unique;
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
    public List<Job> dedupForPipelineDelivery(UUID userId, List<Job> raw) {
        Set<UUID> ownedJobIds = userJobs.findJobIdsByUserId(userId);
        List<Job> ownedJobs = jobs.findAllOwnedByUser(userId);
        List<Job> result = new ArrayList<>();
        Set<String> batch = new HashSet<>();
        int semanticSkips = 0;
        for (Job j : raw) {
            if (j.getCompany() == null || j.getTitle() == null) {
                continue;
            }
            String fp = j.getFingerprint() != null && !j.getFingerprint().isBlank()
                    ? j.getFingerprint()
                    : JobPostingFingerprint.fingerprint(j.getTitle(), j.getCompany(), j.getSourceUrl());
            j.setFingerprint(fp);
            if (!batch.add(fp)) {
                continue;
            }
            Job stored = jobs.findByFingerprint(fp).orElseGet(() -> jobs.save(j));
            if (ownedJobIds.contains(stored.getId())) {
                continue;
            }
            if (ownedJobs.stream().anyMatch(owned -> JobPostingFingerprint.samePosting(owned, stored))) {
                semanticSkips++;
                // #region agent log
                DebugSessionLog.write(
                    "DeduplicationService.dedupForPipelineDelivery",
                    "semantic_duplicate_skipped",
                    "H-DEDUP",
                    Map.of(
                        "userId", userId.toString(),
                        "title", stored.getTitle() != null ? stored.getTitle() : "",
                        "company", stored.getCompany() != null ? stored.getCompany() : "",
                        "sourceUrl", stored.getSourceUrl() != null ? stored.getSourceUrl() : "",
                        "fingerprint", fp));
                // #endregion
                continue;
            }
            result.add(stored);
        }
        log.info("User {} pipeline dedup: {} new candidates from {} raw (semantic skips={})",
                userId, result.size(), raw.size(), semanticSkips);
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

    @Transactional(timeout = 10)
    public int pruneOldSeenJobs(int keepDays) {
        Instant cutoff = Instant.now().minus(keepDays, ChronoUnit.DAYS);
        int deleted = seen.deleteBySeenAtBefore(cutoff);
        if (deleted > 0) log.info("Pruned {} old seen_jobs rows (older than {} days)", deleted, keepDays);
        return deleted;
    }
}
