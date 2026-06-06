package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;

import java.util.*;
import java.util.Locale;
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
 *   15 pts – location match (Ireland / Dublin / Remote / Hybrid / IE / UK)
 *   10 pts – salary range compatibility
 *   10 pts – recency bonus (today=10, 3 days=7, week=4)
 */
@Service
public class JobMatchingService {

    public record ScoredJob(Job job, int score, List<String> matchedTerms, List<String> reasons) {}

    // 3.041 — Location terms that earn full 15-pt location score
    private static final Set<String> LOCATION_MATCH_TOKENS = Set.of(
        "dublin", "ireland", "remote", "hybrid", "worldwide", "anywhere",
        "global", "ie", "uk", "london", "belfast", "wfh"
    );
    private final Clock clock;

    public JobMatchingService(Clock clock) {
        this.clock = clock;
    }

    /** Score all jobs and return sorted top-N. */
    public List<ScoredJob> topN(List<Job> jobs, UserProfile profile, int n) {
        return jobs.stream()
            .map(j -> score(j, profile))
            .filter(s -> isRelevantForProfile(s, profile))
            .sorted(Comparator.comparingInt(ScoredJob::score).reversed())
            .limit(n)
            .collect(Collectors.toList());
    }

    /**
     * When the user set target roles or tech stack, require at least one signal in the
     * job title/description — otherwise Ireland-only location scoring floods the pipeline.
     */
    public static boolean isRelevantForProfile(ScoredJob candidate, UserProfile profile) {
        if (candidate == null || candidate.score() < 10) return false;
        if (!hasRoleOrStackPreference(profile)) return true;
        return isRoleOrStackRelevant(candidate);
    }

    public static boolean hasRoleOrStackPreference(UserProfile profile) {
        if (profile == null) return false;
        boolean hasRoles = profile.getTargetRoles() != null
                && Arrays.stream(profile.getTargetRoles()).anyMatch(r -> r != null && !r.isBlank());
        boolean hasStack = profile.getTechStack() != null
                && Arrays.stream(profile.getTechStack()).anyMatch(t -> t != null && !t.isBlank());
        return hasRoles || hasStack;
    }

    public static boolean isRoleOrStackRelevant(ScoredJob candidate) {
        if (candidate == null || candidate.reasons() == null) return false;
        return candidate.reasons().stream().anyMatch(r -> {
            String lower = r.toLowerCase(Locale.ROOT);
            return lower.contains("role match") || lower.contains("stack keywords matched");
        });
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
        // 3.040 — Filter blanks to avoid divide-by-zero or skewed scoring
        String[] stack = profile.getTechStack() == null ? new String[0] : 
                        Arrays.stream(profile.getTechStack())
                              .filter(s -> s != null && !s.isBlank())
                              .toArray(String[]::new);

        if (stack.length > 0) {
            int stackHits = 0;
            String hayLower = haystack.toLowerCase(Locale.ROOT);
            for (String skill : stack) {
                if (CvSkillCanonical.jobHaystackContains(hayLower, skill)) {
                    matched.add(skill);
                    stackHits++;
                }
            }
            int stackScore = Math.min(40, (stackHits * 40) / stack.length);
            points += stackScore;
            if (stackHits > 0)
                reasons.add(stackHits + "/" + stack.length + " stack keywords matched");
        }

        // ── 2. Role title match (25 pts) ─────────────────────────────────────
        if (profile.getTargetRoles() != null) {
            String jobTitle = job.getTitle() == null ? "" : job.getTitle().toLowerCase();
            for (String role : profile.getTargetRoles()) {
                if (role == null || role.isBlank()) continue;
                String[] roleParts = Arrays.stream(role.toLowerCase().split("\\s+"))
                        .filter(p -> !p.isBlank()).toArray(String[]::new);
                if (roleParts.length == 0) continue;

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
        String locStr = job.getLocation() == null ? "" : job.getLocation().toLowerCase();
        boolean locationMatch = JobDeliveryFilters.isLocationMatch(locStr, profile);

        if (locationMatch) {
            points += 15;
            reasons.add("Location compatible");
        } else if (locStr.isBlank() || locStr.contains("unknown") || locStr.contains("not specified")) {
            points += 5;  // neutral — don't penalise unlisted location
        }
        
        // If the user's own location is set, boost exact match
        if (profile.getLocation() != null && !profile.getLocation().isBlank()) {
            String userLoc = profile.getLocation().toLowerCase();
            if (locStr.contains(userLoc)) {
                points += 5;
                reasons.add("Exact location match");
            }
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
            long now = Instant.now(clock).toEpochMilli();
            long hoursOld = (now - job.getPostedAt().toEpochMilli()) / 3_600_000L;
            if      (hoursOld <= 24)  { points += 10; reasons.add("Posted today"); }
            else if (hoursOld <= 72)  { points +=  7; reasons.add("Posted last 3 days"); }
            else if (hoursOld <= 168) { points +=  4; reasons.add("Posted this week"); }
        }

        return new ScoredJob(job, Math.min(100, points), matched, reasons);
    }
}
