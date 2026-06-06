package com.careerops.controller;

import com.careerops.dto.JobDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.CvService;
import com.careerops.service.DailyLimitService;
import com.careerops.service.EvaluationReportEnrichmentService;
import com.careerops.service.JobDeliveryFilters;
import com.careerops.service.JobDeliveryService;
import com.careerops.service.JobDescriptionEnrichmentService;
import com.careerops.service.JobMatchingService;
import com.careerops.service.JobProfileMatchPolicy;
import com.careerops.service.JobRecommendationService;
import com.careerops.service.KanbanService;
import com.careerops.service.OnboardingDeliveryService;
import com.careerops.service.ParallelJobEvaluationService;
import com.careerops.service.UserJobSkillMatchService;
import com.careerops.util.AuthUtil;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.criteria.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Jobs Controller
 *
 * B1-G2 FIX: detail() (GET /{userJobId}) now calls
 * ParallelJobEvaluationService.evaluateDeep() instead of calling
 * evaluationEnrichment.ensureComplete() directly. evaluateDeep() is
 * cache-aware: on a cache hit it returns instantly; on a miss it runs the
 * full evaluation and writes the result to AiEvalCacheService so subsequent
 * opens of the same job card are served from cache.
 *
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

    private static final Logger log = LoggerFactory.getLogger(JobsController.class);

    private final UserJobRepository                  userJobs;
    private final JobRepository                      jobs;
    private final JobDeliveryService                 delivery;
    private final DailyLimitService                  limits;
    private final JobRecommendationService           recommendations;
    private final KanbanService                      kanban;
    private final JobDescriptionEnrichmentService    descriptionEnrichment;
    private final UserJobSkillMatchService           skillMatchService;
    private final EvaluationReportEnrichmentService  evaluationEnrichment;
    private final UserProfileRepository              profiles;
    private final CvService                          cvService;
    private final ParallelJobEvaluationService       parallelEval;  // B1-G2
    private final OnboardingDeliveryService          onboardingDelivery;

    public JobsController(UserJobRepository u, JobRepository j, JobDeliveryService d,
                          DailyLimitService l, JobRecommendationService r, KanbanService k,
                          JobDescriptionEnrichmentService descriptionEnrichment,
                          UserJobSkillMatchService skillMatchService,
                          EvaluationReportEnrichmentService evaluationEnrichment,
                          UserProfileRepository profiles,
                          CvService cvService,
                          ParallelJobEvaluationService parallelEval,
                          OnboardingDeliveryService onboardingDelivery) {
        this.userJobs              = u;
        this.jobs                  = j;
        this.delivery              = d;
        this.limits                = l;
        this.recommendations       = r;
        this.kanban                = k;
        this.descriptionEnrichment = descriptionEnrichment;
        this.skillMatchService     = skillMatchService;
        this.evaluationEnrichment  = evaluationEnrichment;
        this.profiles              = profiles;
        this.cvService             = cvService;
        this.parallelEval          = parallelEval;
        this.onboardingDelivery    = onboardingDelivery;
    }

    @GetMapping
    @Transactional
    public JobListResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID uid = AuthUtil.currentUserId();
        UserProfile profile = profiles.findByUserId(uid)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete your profile first"));
        int minMatch = JobProfileMatchPolicy.minMatchFloor(profile);
        int safeSize = Math.max(1, Math.min(size, 500));
        Pageable pageable = PageRequest.of(page, safeSize);
        Page<UserJob> userJobPage = userJobs
                .findPipelineByUserIdMinMatchSorted(uid, minMatch, pageable);
        List<UserJob> userJobList = userJobPage.getContent();
        Set<UUID> jobIds = userJobList.stream().map(UserJob::getJobId).collect(java.util.stream.Collectors.toSet());
        Map<UUID, Job> jobMap = new HashMap<>();
        if (!jobIds.isEmpty()) {
            for (Job jj : jobs.findAllById(jobIds)) {
                jobMap.put(jj.getId(), jj);
            }
        }
        List<JobCardResponse> cards = userJobList.stream()
                .map(uj -> JobCardResponse.from(uj, jobMap.get(uj.getJobId())))
                .filter(java.util.Objects::nonNull)
                .filter(card -> JobProfileMatchPolicy.meetsMinMatch(card.matchPercent(), profile))
                .filter(card -> JobDeliveryFilters.titleMatchesDesiredRoles(profile, card.title()))
                .toList();
        long pipelineTotal = userJobs.countByUserIdAndDeletedAtIsNull(uid);
        return new JobListResponse(
            cards,
            limits.getCount(uid),
            limits.max(),
            limits.remaining(uid),
            userJobPage.getTotalElements(),
            page,
            safeSize,
            userJobPage.hasNext(),
            pipelineTotal
        );
    }

    /**
     * GET /{userJobId} — Job detail / job-open endpoint.
     *
     * B1-G2 FIX: now routes through ParallelJobEvaluationService.evaluateDeep()
     * which is cache-aware:
     *   - Cache HIT  → returns the previously computed full report instantly
     *   - Cache MISS → runs full StructuredJobEvaluationBuilder evaluation,
     *                  writes the result to AiEvalCacheService, then returns it
     *
     * This completes the two-tier architecture:
     *   Feed  → evaluateAllLight()  (cheap, matchPercent only, cached)
     *   Open  → evaluateDeep()      (full breakdown, cached after first open)
     */
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

        // B1-G2: route through evaluateDeep() for cache-aware full evaluation
        JobMatchingService.ScoredJob rankedJob =
                new JobMatchingService.ScoredJob(
                        j, uj.getMatchPercent() != null ? uj.getMatchPercent() : 0, List.of(), List.of());
        ParallelJobEvaluationService.ScoredResult deep =
                parallelEval.evaluateDeep(rankedJob, profile, uid, "job_detail");

        persistEvaluationReport(uj, deep.scoreBreakdown());
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
     * Soft-deletes every job in the user's pipeline (Discovered, Applied, etc.).
     * Use before re-running onboarding delivery or after changing match preferences.
     */
    @DeleteMapping("/pipeline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void clearPipeline() {
        UUID uid = AuthUtil.currentUserId();
        int removed = userJobs.softDeleteAllByUserId(uid, java.time.Instant.now());
        org.slf4j.LoggerFactory.getLogger(JobsController.class)
                .info("Cleared {} pipeline jobs for user {}", removed, uid);
    }

    @DeleteMapping("/{userJobId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable UUID userJobId) {
        UUID uid = AuthUtil.currentUserId();
        UserJob uj = userJobs.findByIdAndUserId(userJobId, uid)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        uj.setDeletedAt(java.time.Instant.now());
        userJobs.save(uj);
    }

    @PostMapping("/refresh-skills")
    @Transactional
    public JobListResponse refreshAllSkills(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "500") int size) {
        UUID uid = AuthUtil.currentUserId();
        skillMatchService.refreshAllForUser(uid);
        return list(page, size);
    }

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
    public FetchSummary fetchMore(@RequestParam(defaultValue = "5") int count) {
        int dailyCap = limits.max();
        if (count < 1 || count > dailyCap) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Count must be between 1 and " + dailyCap);
        }
        UUID uid = AuthUtil.currentUserId();
        if (userJobs.countByUserIdAndDeletedAtIsNull(uid) == 0) {
            return startFullPipelineSearch(uid);
        }
        try {
            return delivery.deliver(uid, count);
        } catch (Exception e) {
            log.error("Job fetch failed for user {}: {}", uid, e.getMessage(), e);
            return new FetchSummary(0, limits.getCount(uid), limits.max(), limits.remaining(uid));
        }
    }

    @PostMapping("/fetch-irishjobs")
    public FetchSummary fetchIrishJobs(@RequestParam(defaultValue = "10") int count) {
        if (count < 1 || count > 10) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Count must be between 1 and 10");
        }
        return delivery.deliverFromIrishJobs(AuthUtil.currentUserId(), count);
    }

    @PostMapping("/fetch-live")
    public JobCardResponse fetchLive() {
        UUID uid = AuthUtil.currentUserId();
        if (userJobs.countByUserIdAndDeletedAtIsNull(uid) == 0) {
            startFullPipelineSearch(uid);
            throw new ApiException(HttpStatus.ACCEPTED,
                    "Full job search started — matches will appear in your tracker shortly.");
        }
        return delivery.deliverOneLiveMatch(uid);
    }

    /** Scrape → evaluate → persist when the user has no pipeline rows yet. */
    private FetchSummary startFullPipelineSearch(UUID uid) {
        if (!cvService.hasActiveCv(uid)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload your CV before fetching jobs");
        }
        var started = onboardingDelivery.start(uid, true);
        log.info("User {} empty pipeline — started full job search (stage={})", uid, started.stage());
        return new FetchSummary(
                0,
                limits.getCount(uid),
                limits.max(),
                limits.remaining(uid),
                true,
                started.message());
    }

    /** @deprecated use /fetch-live instead */
    @PostMapping("/fetch-adzuna-live")
    public JobCardResponse fetchAdzunaLive() {
        return delivery.deliverOneLiveAdzunaMatch(AuthUtil.currentUserId());
    }

    /** @deprecated use /fetch-live instead */
    @PostMapping("/fetch-indeed-live")
    public JobCardResponse fetchIndeedLive() {
        return delivery.deliverOneLiveIndeedMatch(AuthUtil.currentUserId());
    }

    @GetMapping("/limits")
    @Transactional(readOnly = true)
    public FetchSummary limits() {
        UUID uid = AuthUtil.currentUserId();
        return new FetchSummary(0, limits.getCount(uid), limits.max(), limits.remaining(uid));
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public KanbanStatsResponse stats() {
        return kanban.getStats(AuthUtil.currentUserId());
    }

    @GetMapping("/recommended")
    @Transactional(readOnly = true)
    public List<RecommendationResponse> recommended() {
        return recommendations.getRecommendations(AuthUtil.currentUserId());
    }

    @GetMapping("/search")
    @Transactional(readOnly = true)
    public JobSearchResponse search(
            @RequestParam(required = false)    String  q,
            @RequestParam(required = false)    String  location,
            @RequestParam(required = false)    Integer minSalary,
            @RequestParam(required = false)    Integer maxSalary,
            @RequestParam(required = false)    Boolean sponsorship,
            @RequestParam(required = false)    Boolean remote,
            @RequestParam(defaultValue = "0")  int     page,
            @RequestParam(defaultValue = "20") int     size) {

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

    private Specification<UserJob> buildSearchSpec(UUID uid, String q, String loc,
            Integer minS, Integer maxS, Boolean spons, Boolean rem) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            p.add(cb.equal(root.get("userId"), uid));
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
