package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Fast, deterministic, zero-cost pre-scoring of jobs against a user profile.
 *
 * Runs BEFORE Gemini to select the best candidates for deep AI evaluation,
 * reducing wasted Gemini API calls on irrelevant jobs.
 *
 * Score breakdown (100 points max):
 *   40 pts – tech stack keyword overlap (title + description)
 *   25 pts – role title match (exact = 25, partial = 15)
 *   15 pts – location match (Ireland / Dublin / Remote)
 *   10 pts – salary range compatibility
 *   10 pts – recency bonus (today=10, 3 days=7, week=4)
 */
@Service
public class JobMatchingService {

    public record ScoredJob(Job job, int score, List<String> matchedTerms, List<String> reasons) {}

    /** Score all jobs and return sorted top-N. */
    public List<ScoredJob> topN(List<Job> jobs, UserProfile profile, int n) {
        return jobs.stream()
            .map(j -> score(j, profile))
            .filter(s -> s.score() >= 10)
            .sorted(Comparator.comparingInt(ScoredJob::score).reversed())
            .limit(n)
            .collect(Collectors.toList());
    }

    /** Convenience: return the top 3 best matches. */
    public List<ScoredJob> top3(List<Job> jobs, UserProfile profile) {
        return topN(jobs, profile, 3);
    }

    private ScoredJob score(Job job, UserProfile profile) {
        int           points  = 0;
        List<String>  matched = new ArrayList<>();
        List<String>  reasons = new ArrayList<>();

        String haystack = ((job.getTitle()       == null ? "" : job.getTitle()) + " "
                        + (job.getDescription()  == null ? "" : job.getDescription())).toLowerCase();

        // ── 1. Tech stack (40 pts) ────────────────────────────────────────────
        if (profile.getTechStack() != null && profile.getTechStack().length > 0) {
            int stackHits = 0;
            for (String skill : profile.getTechStack()) {
                if (haystack.contains(skill.toLowerCase())) {
                    matched.add(skill);
                    stackHits++;
                }
            }
            int stackScore = Math.min(40, (stackHits * 40) / profile.getTechStack().length);
            points += stackScore;
            if (stackHits > 0)
                reasons.add(stackHits + "/" + profile.getTechStack().length + " stack keywords matched");
        }

        // ── 2. Role title match (25 pts) ─────────────────────────────────────
        if (profile.getTargetRoles() != null) {
            String jobTitle = job.getTitle() == null ? "" : job.getTitle().toLowerCase();
            for (String role : profile.getTargetRoles()) {
                String[] roleParts = role.toLowerCase().split("\\s+");
                long roleHits = Arrays.stream(roleParts).filter(jobTitle::contains).count();
                if (roleHits == roleParts.length) {
                    points += 25;
                    reasons.add("Exact role match: " + role);
                    break;
                } else if (roleHits >= Math.ceil(roleParts.length / 2.0)) {
                    points += 15;
                    reasons.add("Partial role match: " + role);
                    break;
                }
            }
        }

        // ── 3. Location (15 pts) ──────────────────────────────────────────────
        String loc = (job.getLocation() == null ? "" : job.getLocation()).toLowerCase();
        if (loc.contains("dublin") || loc.contains("ireland") || loc.contains("remote")) {
            points += 15;
            reasons.add("Ireland/Dublin/Remote location");
        } else if (loc.isBlank() || loc.contains("unknown")) {
            points += 5;
        }

        // ── 4. Salary (10 pts) ────────────────────────────────────────────────
        if (profile.getSalaryMin() != null && job.getSalaryMax() != null && job.getSalaryMax() > 0) {
            if (job.getSalaryMax() >= profile.getSalaryMin()) {
                points += 10;
                reasons.add("Salary compatible");
            }
        } else {
            points += 5; // not listed → neutral
        }

        // ── 5. Recency (10 pts) ───────────────────────────────────────────────
        if (job.getPostedAt() != null) {
            long hoursOld = (System.currentTimeMillis() - job.getPostedAt().toEpochMilli()) / 3_600_000L;
            if      (hoursOld <= 24)  { points += 10; reasons.add("Posted today"); }
            else if (hoursOld <= 72)  { points +=  7; reasons.add("Posted last 3 days"); }
            else if (hoursOld <= 168) { points +=  4; reasons.add("Posted this week"); }
        }

        return new ScoredJob(job, Math.min(100, points), matched, reasons);
    }
}
