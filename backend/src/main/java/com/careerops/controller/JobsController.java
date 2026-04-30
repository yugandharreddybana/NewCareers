package com.careerops.controller;

import com.careerops.dto.JobDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.service.DailyLimitService;
import com.careerops.service.JobDeliveryService;
import com.careerops.service.JobRecommendationService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/jobs")
public class JobsController {

    private final UserJobRepository        userJobs;
    private final JobRepository            jobs;
    private final JobDeliveryService       delivery;
    private final DailyLimitService        limits;
    private final JobRecommendationService recommendations;

    public JobsController(UserJobRepository u, JobRepository j, JobDeliveryService d,
                          DailyLimitService l, JobRecommendationService r) {
        this.userJobs        = u;
        this.jobs            = j;
        this.delivery        = d;
        this.limits          = l;
        this.recommendations = r;
    }

    // ── Existing endpoints (Phase 1 — unchanged) ────────────────────────────────

    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> list() {
        UUID uid = AuthUtil.currentUserId();
        List<JobCardResponse> cards = userJobs.findByUserIdOrderByDeliveredAtDesc(uid).stream()
                .map(uj -> {
                    Job j = jobs.findById(uj.getJobId()).orElse(null);
                    if (j == null) return null;
                    return new JobCardResponse(
                        uj.getId(), j.getId(), j.getTitle(), j.getCompany(), j.getLocation(),
                        j.getSalaryMin(), j.getSalaryMax(), j.getCurrency(), j.getSponsorship(),
                        uj.getMatchPercent(), uj.getVerdict(),
                        uj.getHumanSummary(), j.getSourceName(),
                        j.getPostedAt(), uj.getDeliveredAt(),
                        uj.getKanbanColumn(), uj.getStatus(), j.getSourceUrl(),
                        uj.getMatchedSkills(), uj.getUnmatchedSkills()
                    );
                }).filter(java.util.Objects::nonNull).toList();
        return Map.of(
            "items",      cards,
            "dailyCount", limits.getCount(uid),
            "dailyLimit", limits.max(),
            "remaining",  limits.remaining(uid)
        );
    }

    @GetMapping("/{userJobId}")
    @Transactional(readOnly = true)
    public JobDetailResponse detail(@PathVariable UUID userJobId) {
        UUID uid = AuthUtil.currentUserId();
        UserJob uj = userJobs.findByIdAndUserId(userJobId, uid)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        Job j = jobs.findById(uj.getJobId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job missing"));
        return new JobDetailResponse(
            uj.getId(), j.getId(), j.getTitle(), j.getCompany(), j.getLocation(),
            j.getSalaryMin(), j.getSalaryMax(), j.getCurrency(), j.getSponsorship(),
            j.getDescription(), j.getSourceUrl(), j.getSourceName(), j.getSector(),
            j.getPostedAt(), uj.getMatchPercent(), uj.getAiScore(),
            uj.getMatchedSkills(), uj.getUnmatchedSkills(), uj.getCvImprovementTips(),
            uj.getHumanSummary(), uj.getVerdict(), uj.getKanbanColumn(), uj.getStatus()
        );
    }

    @PostMapping("/fetch")
    public FetchSummary fetchMore(@RequestParam(defaultValue = "5") int count) {
        return delivery.deliver(AuthUtil.currentUserId(), count);
    }

    @GetMapping("/limits")
    @Transactional(readOnly = true)
    public Map<String, Integer> limits() {
        UUID uid = AuthUtil.currentUserId();
        return Map.of(
            "dailyCount", limits.getCount(uid),
            "dailyLimit", limits.max(),
            "remaining",  limits.remaining(uid)
        );
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public Map<String, Object> stats() {
        UUID uid = AuthUtil.currentUserId();
        Map<String, Long> byColumn = new HashMap<>();
        for (Object[] row : userJobs.countByColumnForUser(uid)) {
            byColumn.put((String) row[0], (Long) row[1]);
        }
        long total      = byColumn.values().stream().mapToLong(Long::longValue).sum();
        long applied    = byColumn.getOrDefault("Applied",   0L);
        long interviews = byColumn.getOrDefault("Interview", 0L);
        long offers     = byColumn.getOrDefault("Offer",     0L);
        double avgMatch = userJobs.avgMatchPercentForUser(uid);
        return Map.of(
            "total",      total,
            "applied",    applied,
            "interviews", interviews,
            "offers",     offers,
            "avgMatch",   Math.round(avgMatch * 10.0) / 10.0
        );
    }

    // ── Section 7 — Task 71: GET /jobs/recommended ─────────────────────────────

    /**
     * Returns top 5 recommended jobs from the user's Discovered pipeline.
     * Each job includes a "whyRecommended" label explaining the match reason.
     * Must be declared BEFORE /{userJobId} to avoid the wildcard capturing
     * the literal string "recommended".
     */
    @GetMapping("/recommended")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> recommended() {
        return recommendations.getRecommendations(AuthUtil.currentUserId());
    }

    // ── Section 7 — Task 72: GET /jobs/search ─────────────────────────────────

    /**
     * Server-side filtered search across the user's existing job pipeline.
     * Filters applied in-memory after fetching all user_jobs
     * (efficient for typical pipeline size of < 500 jobs).
     *
     * Query params: q, location, minSalary, maxSalary, sponsorship, remote, page, size
     */
    @GetMapping("/search")
    @Transactional(readOnly = true)
    public Map<String, Object> search(
            @RequestParam(required = false)       String  q,
            @RequestParam(required = false)       String  location,
            @RequestParam(required = false)       Integer minSalary,
            @RequestParam(required = false)       Integer maxSalary,
            @RequestParam(required = false)       Boolean sponsorship,
            @RequestParam(required = false)       Boolean remote,
            @RequestParam(defaultValue = "0")     int     page,
            @RequestParam(defaultValue = "20")    int     size) {

        UUID uid = AuthUtil.currentUserId();

        List<JobCardResponse> filtered = userJobs
                .findByUserIdOrderByDeliveredAtDesc(uid)
                .stream()
                .map(uj -> {
                    Job j = jobs.findById(uj.getJobId()).orElse(null);
                    if (j == null) return null;
                    return new JobCardResponse(
                        uj.getId(), j.getId(), j.getTitle(), j.getCompany(), j.getLocation(),
                        j.getSalaryMin(), j.getSalaryMax(), j.getCurrency(), j.getSponsorship(),
                        uj.getMatchPercent(), uj.getVerdict(),
                        uj.getHumanSummary(), j.getSourceName(),
                        j.getPostedAt(), uj.getDeliveredAt(),
                        uj.getKanbanColumn(), uj.getStatus(), j.getSourceUrl(),
                        uj.getMatchedSkills(), uj.getUnmatchedSkills()
                    );
                })
                .filter(Objects::nonNull)
                .filter(c -> matchSearch(c, q, location, minSalary, maxSalary, sponsorship, remote))
                .toList();

        int total    = filtered.size();
        int safeSize = Math.max(1, Math.min(size, 50));
        int from     = Math.min(page * safeSize, total);
        int to       = Math.min(from + safeSize, total);

        return Map.of(
            "items",      filtered.subList(from, to),
            "total",      total,
            "page",       page,
            "size",       safeSize,
            "totalPages", (int) Math.ceil((double) total / safeSize)
        );
    }

    // ── Search filter helper ───────────────────────────────────────────────────

    private boolean matchSearch(JobCardResponse c, String q, String location,
                                Integer minSalary, Integer maxSalary,
                                Boolean sponsorship, Boolean remote) {
        // Keyword filter (title OR company)
        if (q != null && !q.isBlank()) {
            String ql = q.toLowerCase();
            boolean hit = (c.title()   != null && c.title().toLowerCase().contains(ql))
                       || (c.company() != null && c.company().toLowerCase().contains(ql));
            if (!hit) return false;
        }
        // Location filter
        if (location != null && !location.isBlank() && !"All Ireland".equalsIgnoreCase(location)) {
            String locL = c.location() != null ? c.location().toLowerCase() : "";
            if ("Remote".equalsIgnoreCase(location)) {
                if (!locL.contains("remote")) return false;
            } else {
                if (!locL.contains(location.toLowerCase())) return false;
            }
        }
        // Remote toggle
        if (Boolean.TRUE.equals(remote)) {
            String locL = c.location() != null ? c.location().toLowerCase() : "";
            if (!locL.contains("remote")) return false;
        }
        // Salary range
        if (minSalary != null && c.salaryMax() != null && c.salaryMax() < minSalary) return false;
        if (maxSalary != null && c.salaryMin() != null && c.salaryMin() > maxSalary) return false;
        // Sponsorship toggle
        if (Boolean.TRUE.equals(sponsorship) && !Boolean.TRUE.equals(c.sponsorship())) return false;

        return true;
    }
}
