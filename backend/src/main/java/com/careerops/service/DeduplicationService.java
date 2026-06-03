package com.careerops.service;

import com.careerops.model.JobListing;
import com.careerops.service.sources.FingerprintUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Removes duplicate job listings using a SHA-256 fingerprint of (title, company, url).
 *
 * Performance characteristics:
 * - O(n) single pass using a ConcurrentHashMap set.
 * - Input is capped at MAX_INPUT_SIZE to guard against runaway scraper responses.
 * - Safe to call from multiple threads (ConcurrentHashMap.putIfAbsent).
 */
@Service
public class DeduplicationService {

    private static final Logger log = LoggerFactory.getLogger(DeduplicationService.class);
    private static final int MAX_INPUT_SIZE = 5_000;

    public List<JobListing> deduplicate(List<JobListing> jobs) {
        if (jobs == null || jobs.isEmpty()) return Collections.emptyList();

        List<JobListing> input = jobs.size() > MAX_INPUT_SIZE ? jobs.subList(0, MAX_INPUT_SIZE) : jobs;
        if (jobs.size() > MAX_INPUT_SIZE) {
            log.warn("DeduplicationService: input capped from {} to {}", jobs.size(), MAX_INPUT_SIZE);
        }

        ConcurrentHashMap<String, Boolean> seen = new ConcurrentHashMap<>(input.size() * 2);
        List<JobListing> unique = new ArrayList<>(input.size());

        for (JobListing job : input) {
            String fp = FingerprintUtil.fingerprint(
                    job.getTitle()   != null ? job.getTitle()   : "",
                    job.getCompany() != null ? job.getCompany() : "",
                    job.getUrl()     != null ? job.getUrl()     : ""
            );
            if (seen.putIfAbsent(fp, Boolean.TRUE) == null) {
                unique.add(job);
            }
        }

        log.info("Dedup: {} → {} unique jobs", input.size(), unique.size());
        return unique;
    }
}
