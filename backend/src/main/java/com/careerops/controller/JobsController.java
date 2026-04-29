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
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/jobs")
public class JobsController {

    private final UserJobRepository userJobs;
    private final JobRepository jobs;
    private final JobDeliveryService delivery;
    private final DailyLimitService limits;

    public JobsController(UserJobRepository u, JobRepository j, JobDeliveryService d, DailyLimitService l) {
        this.userJobs = u; this.jobs = j; this.delivery = d; this.limits = l;
    }

    @GetMapping
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
                    j.getPostedAt(), uj.getDeliveredAt(),
                    uj.getKanbanColumn(), uj.getStatus(), j.getSourceUrl()
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
    public Map<String,Integer> limits() {
        UUID uid = AuthUtil.currentUserId();
        return Map.of(
            "dailyCount", limits.getCount(uid),
            "dailyLimit", limits.max(),
            "remaining", limits.remaining(uid)
        );
    }

    /**
     * GET /jobs/stats
     * Returns aggregated application stats for the current user:
     * total matched, applied, interview, offer counts and average match %.
     */
    @GetMapping("/stats")
    public Map<String,Object> stats() {
        UUID uid = AuthUtil.currentUserId();
        long total      = userJobs.countByUserId(uid);
        long applied    = userJobs.countByUserIdAndKanbanColumn(uid, "Applied");
        long interviews = userJobs.countByUserIdAndKanbanColumn(uid, "Interview");
        long offers     = userJobs.countByUserIdAndKanbanColumn(uid, "Offer");

        // Compute average match % across all user jobs
        double avgMatch = userJobs.findByUserIdOrderByDeliveredAtDesc(uid).stream()
            .filter(uj -> uj.getMatchPercent() != null)
            .mapToInt(uj -> uj.getMatchPercent())
            .average()
            .orElse(0.0);

        return Map.of(
            "total",      total,
            "applied",    applied,
            "interviews", interviews,
            "offers",     offers,
            "avgMatch",   Math.round(avgMatch * 10.0) / 10.0
        );
    }
}
