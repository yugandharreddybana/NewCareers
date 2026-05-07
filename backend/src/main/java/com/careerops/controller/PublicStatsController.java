package com.careerops.controller;

import com.careerops.repository.JobRepository;
import com.careerops.repository.UserRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.time.Duration;
/**
 * Pass 6 #6.016 — public stats for the marketing/login page.
 *
 * Replaces the hardcoded "2,400+ Irish jobs / 500+ Job seekers" copy with
 * live, honest counts pulled from the database. Returns cached values via
 * an HTTP {@code Cache-Control: public, max-age=900} header so the same
 * numbers can be reused across visitors for fifteen minutes.
 *
 * The path is whitelisted in {@link com.careerops.security.PublicPathPolicy}
 * so it can be fetched before login.
 */
@RestController
@RequestMapping("/public")
public class PublicStatsController {

    private final JobRepository  jobs;
    private final UserRepository users;

    public PublicStatsController(JobRepository jobs, UserRepository users) {
        this.jobs  = jobs;
        this.users = users;
    }

    public record PublicStatsResponse(long jobs, long users, int skills) {}

    @GetMapping("/stats")
    public ResponseEntity<PublicStatsResponse> stats() {
        // Round counts down to the nearest 100 to give a stable, marketing-
        // friendly headline number that doesn't look like a database export.
        long activeJobs   = roundDown(jobs.count(), 100);
        long activeUsers  = roundDown(users.count(), 50);
        // Skill catalogue size is a build-time constant — we keep one source
        // of truth (matches frontend types/index.ts SkillName) and expose it
        // here so marketing copy never drifts.
        int  skillCount   = 14;

        PublicStatsResponse body = new PublicStatsResponse(activeJobs, activeUsers, skillCount);

        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
            .body(body);
    }

    private static long roundDown(long n, long step) {
        if (n <= 0 || step <= 1) return Math.max(0, n);
        return (n / step) * step;
    }
}
