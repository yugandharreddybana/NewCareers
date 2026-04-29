package com.careerops.controller;

import com.careerops.dto.JobDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.service.DailyLimitService;
import com.careerops.service.JobDeliveryService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/jobs")
public class JobsController {

    private final UserJobRepository userJobs;
    private final JobRepository     jobs;
    private final JobDeliveryService delivery;
    private final DailyLimitService  limits;

    public JobsController(UserJobRepository u, JobRepository j, JobDeliveryService d, DailyLimitService l) {
        this.userJobs = u; this.jobs = j; this.delivery = d; this.limits = l;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Map<String,Object> list() {
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
            "items", cards,
            "dailyCount", limits.getCount(uid),
            "dailyLimit", limits.max(),
            "remaining", limits.remaining(uid)
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
    public Map<String,Integer> limits() {
        UUID uid = AuthUtil.currentUserId();
        return Map.of(
            "dailyCount",  limits.getCount(uid),
            "dailyLimit",  limits.max(),
            "remaining",   limits.remaining(uid)
        );
    }

    /**
     * GET /jobs/stats
     * Returns aggregated application stats for the current user.
     * Uses two optimised JPQL aggregation queries instead of N individual counts.
     */
    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public Map<String,Object> stats() {
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
}
