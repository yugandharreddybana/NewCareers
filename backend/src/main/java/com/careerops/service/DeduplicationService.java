package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.SeenJob;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SeenJobRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class DeduplicationService {

    private final JobRepository jobs;
    private final SeenJobRepository seen;

    public DeduplicationService(JobRepository jobs, SeenJobRepository seen) {
        this.jobs = jobs; this.seen = seen;
    }

    @Transactional
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

    @Transactional
    public void markSeen(UUID userId, List<Job> delivered) {
        for (Job j : delivered) {
            if (!seen.existsByUserIdAndFingerprint(userId, j.getFingerprint())) {
                seen.save(SeenJob.builder().userId(userId).fingerprint(j.getFingerprint()).build());
            }
        }
    }
}
