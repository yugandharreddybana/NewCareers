package com.careerops.controller;

import com.careerops.dto.JobDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.service.CvService;
import com.careerops.service.DailyLimitService;
import com.careerops.service.EvaluationReportEnrichmentService;
import com.careerops.service.JobDeliveryService;
import com.careerops.service.JobDescriptionEnrichmentService;
import com.careerops.service.JobRecommendationService;
import com.careerops.service.KanbanService;
import com.careerops.service.UserJobSkillMatchService;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.careerops.util.AuthUtil;
import jakarta.persistence.criteria.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/jobs")
@io.micrometer.core.annotation.Timed
public class JobsController {

    private final UserJobRepository        userJobs;
    private final JobRepository            jobs;
    private final JobDeliveryService       delivery;
    private final DailyLimitService        limits;
    private final JobRecommendationService recommendations;
    private final KanbanService                    kanban;
    private final JobDescriptionEnrichmentService  descriptionEnrichment;
    private final UserJobSkillMatchService       skillMatchService;
    private final EvaluationReportEnrichmentService evaluationEnrichment;
    private final UserProfileRepository          profiles;
    private final CvService                      cvService;

    public JobsController(UserJobRepository u, JobRepository j, JobDeliveryService d,
                          DailyLimitService l, JobRecommendationService r, KanbanService k,
                          JobDescriptionEnrichmentService descriptionEnrichment,
                          UserJobSkillMatchService skillMatchService,
                          EvaluationReportEnrichmentService evaluationEnrichment,
                          UserProfileRepository profiles,
                          CvService cvService) {
        this.userJobs               = u;
        this.jobs                   = j;
        this.delivery               = d;
        this.limits                 = l;
        this.recommendations        = r;
        this.kanban                 = k;
        this.descriptionEnrichment  = descriptionEnrichment;
        this.skillMatchService      = skillMatchService;
        this.evaluationEnrichment   = evaluationEnrichment;
        this.profiles               = profiles;
        this.cvService              = cvService;
    }

    @GetMapping
    @Transactional
    public JobListResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID uid = AuthUtil.currentUserId();
        // List every job in the user's pipeline — min-match is enforced when delivering new jobs,
        // not when viewing jobs already saved to their tracker.
        int safeSize = Math.max(1, Math.min(size, 500));
        Pageable pageable = PageRequest.of(page, safeSize);
        Page<UserJob> userJobPage = userJobs.findByUserIdOrderByDeliveredAtDesc(uid, pageable);
        List<UserJob> userJobList = userJobPage.getContent();
        Set<UUID> jobIds = userJobList.stream().map(UserJob::getJobId).collect(java.util.stream.Collectors.toSet());
        Map<UUID, Job> jobMap = new HashMap<>();
        if (!jobIds.isEmpty()) {
            for (Job j : jobs.findAllById(jobIds)) {
                jobMap.put(j.getId(), j);
            }
        }
        for (UserJob uj : userJobList) {
            Job j = jobMap.get(uj.getJobId());
            if (j != null) {
                skillMatchService.refreshAndPersist(uj, j);
            }
        }
        List<JobCardResponse> cards = userJobList.stream()
                .map(uj -> JobCardResponse.from(uj, jobMap.get(uj.getJobId())))
                .filter(java.util.Objects::nonNull)
                .toList();
        return new JobListResponse(
            cards,
            limits.getCount(uid),
            limits.max(),
            limits.remaining(uid),
            userJobPage.getTotalElements(),
            page,
            safeSize,
            userJobPage.hasNext()
        );
    }

    @GetMapping("/{userJobId}")
    @Transactional
    public JobDetailResponse detail(@PathVariable UUID userJobId) {
        UUID uid = AuthUtil.currentUserId();
        UserJob uj = userJobs.findByIdAndUserId(userJobId, uid)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        Job j = jobs.findById(uj.getJobId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job missing"));
        j = descriptionEnrichment.enrichIfMissing(j);
        skillMatchService.refreshAndPersist(uj, j);
        UserProfile profile = profiles.findByUserId(uid)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete your profile first"));
        String cvText = cvService.activeCvText(uid);
        JsonNode report = evaluationEnrichment.ensureComplete(
            uid, j, profile, cvText, uj.getScoreBreakdown(), "job_detail");
        persistEvaluationReport(uj, report);
        return JobDetailResponse.from(uj, j);
    }

    private void persistEvaluationReport(UserJob uj, JsonNode report) {
        if (report == null || !report.isObject()) return;
        uj.setMatchPercent(report.path("matchPercent").asInt(
            uj.getMatchPercent() != null ? uj.getMatchPercent() : 0));
        uj.setAiScore(report.path("overallScore").asInt(
            uj.getAiScore() != null ? uj.getAiScore() : 0));
        if (report.hasNonNull("humanSummary")) {
            uj.setHumanSummary(report.path("humanSummary").asText(uj.getHumanSummary()));
        }
        if (report.hasNonNull("verdict")) {
            uj.setVerdict(report.path("verdict").asText(uj.getVerdict()));
        }
        if (report.has("matchedSkills") && report.get("matchedSkills").isArray()) {
            uj.setMatchedSkills(jsonStringArray(report.get("matchedSkills")));
        }
        if (report.has("unmatchedSkills") && report.get("unmatchedSkills").isArray()) {
            uj.setUnmatchedSkills(jsonStringArray(report.get("unmatchedSkills")));
        }
        if (report.has("cvImprovementTips") && report.get("cvImprovementTips").isArray()) {
            uj.setCvImprovementTips(jsonStringArray(report.get("cvImprovementTips")));
        }
        uj.setScoreBreakdown(report);
        userJobs.save(uj);
    }

    private static String[] jsonStringArray(JsonNode array) {
        java.util.List<String> out = new java.util.ArrayList<>();
        array.forEach(n -> {
            String s = n.asText(null);
            if (s != null && !s.isBlank()) out.add(s);
        });
        return out.toArray(new String[0]);
    }

    /**
     * Soft-delete a job from the user's pipeline.
     * DELETE /api/jobs/{userJobId}
     */
    @DeleteMapping("/{userJobId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable UUID userJobId) {
        UUID uid = AuthUtil.currentUserId();
        UserJob uj = userJobs.findByIdAndUserId(userJobId, uid)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        // Soft-delete via entity state — avoids @SQLDelete + @Version parameter binding issues on H2.
        uj.setDeletedAt(java.time.Instant.now());
        userJobs.save(uj);
    }

    /**
     * Recompute matched/unmatched skills for every job in the user's pipeline (e.g. after CV upload or matcher fixes).
     * POST /api/jobs/refresh-skills
     */
    @PostMapping("/refresh-skills")
    @Transactional
    public JobListResponse refreshAllSkills(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "500") int size) {
        UUID uid = AuthUtil.currentUserId();
        skillMatchService.refreshAllForUser(uid);
        return list(page, size);
    }

    /**
     * Re-fetch posting text from the source URL (use when the overview description is empty).
     */
    @PostMapping("/{userJobId}/description")
    @Transactional
    public JobDetailResponse enrichDescription(@PathVariable UUID userJobId) {
        UUID uid = AuthUtil.currentUserId();
        UserJob uj = userJobs.findByIdAndUserId(userJobId, uid)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        Job j = jobs.findById(uj.getJobId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job missing"));
        j = descriptionEnrichment.enrich(j, true);
        skillMatchService.refreshAndPersist(uj, j);
        return JobDetailResponse.from(uj, j);
    }

    @PostMapping("/fetch")
    public FetchSummary fetchMore(@RequestParam(defaultValue = "10") int count) {
        if (count < 1 || count > 25) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Count must be between 1 and 25");
        }
        return delivery.deliver(AuthUtil.currentUserId(), count);
    }

    /**
     * Fetch up to 10 profile-matched jobs from IrishJobs.ie only.
     * POST /api/jobs/fetch-irishjobs?count=10
     */
    @PostMapping("/fetch-irishjobs")
    public FetchSummary fetchIrishJobs(@RequestParam(defaultValue = "10") int count) {
        if (count < 1 || count > 10) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Count must be between 1 and 10");
        }
        return delivery.deliverFromIrishJobs(AuthUtil.currentUserId(), count);
    }

    /**
     * Fetch one live job from all available sources (Adzuna → Indeed fallback),
     * profile-ranked, and add it to the user's pipeline.
     * POST /api/jobs/fetch-live
     */
    @PostMapping("/fetch-live")
    public JobCardResponse fetchLive() {
        return delivery.deliverOneLiveMatch(AuthUtil.currentUserId());
    }

    /**
     * Fetch one live job from Adzuna, profile-ranked, and add it to the user's pipeline.
     * POST /api/jobs/fetch-adzuna-live
     * @deprecated use /fetch-live instead
     */
    @PostMapping("/fetch-adzuna-live")
    public JobCardResponse fetchAdzunaLive() {
        return delivery.deliverOneLiveAdzunaMatch(AuthUtil.currentUserId());
    }

    /**
     * Fetch one live job from Indeed (Ireland RSS), profile-ranked, and add it to the user's pipeline.
     * POST /api/jobs/fetch-indeed-live
     * @deprecated use /fetch-live instead
     */
    @PostMapping("/fetch-indeed-live")
    public JobCardResponse fetchIndeedLive() {
        return delivery.deliverOneLiveIndeedMatch(AuthUtil.currentUserId());
    }

    @GetMapping("/limits")
    @Transactional(readOnly = true)
    public FetchSummary limits() {
        UUID uid = AuthUtil.currentUserId();
        return new FetchSummary(
            0,
            limits.getCount(uid),
            limits.max(),
            limits.remaining(uid)
        );
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public KanbanStatsResponse stats() {
        return kanban.getStats(AuthUtil.currentUserId());
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
    public List<RecommendationResponse> recommended() {
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
    public JobSearchResponse search(
            @RequestParam(required = false)       String  q,
            @RequestParam(required = false)       String  location,
            @RequestParam(required = false)       Integer minSalary,
            @RequestParam(required = false)       Integer maxSalary,
            @RequestParam(required = false)       Boolean sponsorship,
            @RequestParam(required = false)       Boolean remote,
            @RequestParam(defaultValue = "0")     int     page,
            @RequestParam(defaultValue = "20")    int     size) {

        UUID uid = AuthUtil.currentUserId();
        int safeSize = Math.max(1, Math.min(size, 50));
        Pageable pageable = PageRequest.of(page, safeSize, Sort.by("deliveredAt").descending());

        Specification<UserJob> spec = buildSearchSpec(uid, q, location, minSalary, maxSalary, sponsorship, remote);
        Page<UserJob> userJobPage = userJobs.findAll(spec, pageable);

        List<JobCardResponse> cards = userJobPage.getContent().stream()
                .map(uj -> JobCardResponse.from(uj, uj.getJob()))
                .filter(Objects::nonNull)
                .toList();

        return new JobSearchResponse(
            cards,
            userJobPage.getTotalElements(),
            page,
            safeSize,
            userJobPage.getTotalPages()
        );
    }

    private Specification<UserJob> buildSearchSpec(UUID uid, String q, String loc, Integer minS, Integer maxS, Boolean spons, Boolean rem) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            p.add(cb.equal(root.get("userId"), uid));

            // Eager fetch Job to avoid N+1, but only for the data query (not count)
            if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                root.fetch("job", JoinType.INNER);
            }
            Join<UserJob, Job> job = root.join("job");

            if (q != null && !q.isBlank()) {
                String pat = "%" + q.toLowerCase() + "%";
                p.add(cb.or(
                    cb.like(cb.lower(job.get("title")), pat),
                    cb.like(cb.lower(job.get("company")), pat)
                ));
            }
            if (loc != null && !loc.isBlank() && !"All Ireland".equalsIgnoreCase(loc)) {
                if ("Remote".equalsIgnoreCase(loc)) {
                    p.add(cb.like(cb.lower(job.get("location")), "%remote%"));
                } else {
                    p.add(cb.like(cb.lower(job.get("location")), "%" + loc.toLowerCase() + "%"));
                }
            }
            if (Boolean.TRUE.equals(rem)) {
                p.add(cb.like(cb.lower(job.get("location")), "%remote%"));
            }
            if (minS != null) {
                p.add(cb.or(cb.isNull(job.get("salaryMax")), cb.greaterThanOrEqualTo(job.get("salaryMax"), minS)));
            }
            if (maxS != null) {
                p.add(cb.or(cb.isNull(job.get("salaryMin")), cb.lessThanOrEqualTo(job.get("salaryMin"), maxS)));
            }
            if (Boolean.TRUE.equals(spons)) {
                p.add(cb.equal(job.get("sponsorship"), true));
            }

            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
