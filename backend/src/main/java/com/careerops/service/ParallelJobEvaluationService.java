package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Batch 3 — Parallel job evaluation engine (updated).
 *
 * Changes in this batch:
 *
 * 1. LIGHT vs DEEP split:
 *    - evaluateAllLight()  → used on the initial feed. Runs a cheap, fast scoring prompt
 *      (matchPercent only, no PDF, no detailed breakdown). Results are cached.
 *    - evaluateDeep()      → triggered when the user opens a job card or requests a PDF.
 *      Runs the full StructuredJobEvaluationBuilder and caches the result.
 *
 * 2. Cache:
 *    - Before every evaluation (light or deep), checks AiEvalCacheService.
 *    - Writes result to cache after a successful evaluation.
 *    - Deep results are served from cache if the user revisits the same job.
 *
 * 3. Provider routing:
 *    - All AI calls go via AiProviderRouter (NVIDIA → Claude fallback).
 *
 * Concurrency model unchanged: Java 21 virtual threads per task.
 */
@Service
public class ParallelJobEvaluationService {

    private static final Logger log = LoggerFactory.getLogger(ParallelJobEvaluationService.class);

    private static final int MAX_RETRIES = 2;

    // Light score prompt — cheap, fast, no JSON schema required
    private static final String LIGHT_SCORE_PROMPT = """
            You are a job-matching engine. Given the user's CV summary and a job description,
            return ONLY a JSON object with one field: {"matchPercent": <integer 0-100>}.
            Be accurate but concise. No explanation.

            CV summary:
            %s

            Job title: %s
            Job description (first 800 chars): %.800s
            """;

    private final StructuredJobEvaluationBuilder evaluationBuilder;
    private final EvaluationReportValidator validator;
    private final EvaluationReportEnrichmentService evaluationEnrichment;
    private final JobEvaluationProgressStore progressStore;
    private final UserJobRepository userJobs;
    private final UserProfileRepository profiles;
    private final TransactionTemplate transactionTemplate;
    private final CvService cvService;
    private final JobMatchingService matcher;
    private final DeduplicationService dedup;
    private final ObjectMapper mapper;

    // Batch 3 additions
    private final AiEvalCacheService cache;
    private final AiProviderRouter router;

    @Value("${jobs.parallel.eval.pool.size:15}")
    private int evalPoolSize;

    private Executor evalExecutor;

    @Autowired
    public ParallelJobEvaluationService(
            StructuredJobEvaluationBuilder evaluationBuilder,
            EvaluationReportValidator validator,
            EvaluationReportEnrichmentService evaluationEnrichment,
            JobEvaluationProgressStore progressStore,
            UserJobRepository userJobs,
            UserProfileRepository profiles,
            PlatformTransactionManager txManager,
            CvService cvService,
            JobMatchingService matcher,
            DeduplicationService dedup,
            ObjectMapper mapper,
            AiEvalCacheService cache,
            AiProviderRouter router) {
        this.evaluationBuilder = evaluationBuilder;
        this.validator = validator;
        this.evaluationEnrichment = evaluationEnrichment;
        this.progressStore = progressStore;
        this.userJobs = userJobs;
        this.profiles = profiles;
        this.transactionTemplate = new TransactionTemplate(txManager);
        this.cvService = cvService;
        this.matcher = matcher;
        this.dedup = dedup;
        this.mapper = mapper;
        this.cache = cache;
        this.router = router;
    }

    @PostConstruct
    public void initExecutor() {
        try {
            this.evalExecutor = Executors.newVirtualThreadPerTaskExecutor();
            log.info("ParallelJobEvaluationService: using virtual thread executor");
        } catch (Exception e) {
            log.warn("Virtual threads not available, using platform thread pool");
            java.util.concurrent.ThreadPoolExecutor pool = new java.util.concurrent.ThreadPoolExecutor(
                    evalPoolSize, evalPoolSize * 2,
                    60L, java.util.concurrent.TimeUnit.SECONDS,
                    new java.util.concurrent.LinkedBlockingQueue<>(500));
            pool.setThreadFactory(r -> {
                Thread t = new Thread(r, "job-eval-" + System.nanoTime());
                t.setDaemon(true);
                return t;
            });
            this.evalExecutor = pool;
        }
    }

    // ── PUBLIC: Light evaluation for the feed ──────────────────────────────────

    /**
     * Evaluate all jobs with a LIGHT (cheap, fast) score.
     * Only computes matchPercent — no full breakdown, no PDF.
     * Used for the initial job feed so the UI is fast and AI costs are low.
     *
     * Cache: reads from cache first; writes to cache on new evaluations.
     */
    public List<ScoredResult> evaluateAllLight(
            List<JobMatchingService.ScoredJob> jobs,
            UserProfile profile,
            UUID userId,
            String sourceTag) {

        if (jobs.isEmpty()) return List.of();

        String cvSummary = buildCvSummary(cvService.activeCvText(userId));
        progressStore.setTotal(userId, jobs.size());
        log.info("[Parallel eval LIGHT] Starting fan-out: {} jobs, userId={}", jobs.size(), userId);

        List<CompletableFuture<ScoredResult>> futures = jobs.stream()
                .map(rankedJob -> CompletableFuture
                        .supplyAsync(
                                () -> lightScore(rankedJob, userId, cvSummary),
                                evalExecutor)
                        .exceptionally(ex -> {
                            log.error("[Parallel eval LIGHT] Failure for job '{}': {}",
                                    rankedJob.job().getTitle(), ex.getMessage());
                            progressStore.recordJobEvaluated(userId, rankedJob.job().getSourceName());
                            return ScoredResult.failed(rankedJob.job(), mapper);
                        }))
                .collect(Collectors.toList());

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        List<ScoredResult> results = futures.stream()
                .map(CompletableFuture::join)
                .sorted((a, b) -> Integer.compare(b.matchPercent(), a.matchPercent()))
                .collect(Collectors.toList());

        log.info("[Parallel eval LIGHT] Complete: {} results for userId={}", results.size(), userId);
        return results;
    }

    // ── PUBLIC: Deep evaluation on job open ────────────────────────────────────

    /**
     * Run the full, deep AI evaluation for a single job.
     * Called when the user opens a job card or explicitly requests a full report/PDF.
     *
     * Cache: returns cached deep result if available. Writes to cache on new evaluation.
     *
     * @param rankedJob  the job to evaluate deeply
     * @param profile    the user's profile
     * @param userId     for cache key and CV lookup
     * @param sourceTag  evaluation source tag
     * @return full ScoredResult with complete scoreBreakdown JSON
     */
    public ScoredResult evaluateDeep(
            JobMatchingService.ScoredJob rankedJob,
            UserProfile profile,
            UUID userId,
            String sourceTag) {

        Job job = rankedJob.job();
        UUID jobId = job.getId();

        // Cache hit — return immediately
        JsonNode cached = cache.getDeep(userId, jobId);
        if (cached != null) {
            int matchPercent = cached.path("matchPercent").asInt(
                    cached.path("overallScore").asInt(0));
            log.debug("[Parallel eval DEEP] Cache HIT userId={} jobId={} matchPercent={}",
                    userId, jobId, matchPercent);
            return new ScoredResult(job, cached, matchPercent);
        }

        // Cache miss — run full evaluation with retries
        String cvText = cvService.activeCvText(userId);
        ScoredResult result = evaluateWithRetry(rankedJob, profile, userId, cvText, sourceTag);

        // Write to deep cache
        if (result.scoreBreakdown() != null) {
            cache.putDeep(userId, jobId, result.scoreBreakdown());
            // Also update the light cache so the feed score is consistent
            cache.putLight(userId, jobId, result.matchPercent());
        }

        return result;
    }

    /**
     * Legacy entry point (kept for backward-compat with JobDeliveryService).
     * Delegates to evaluateAllLight() — upgrade callers gradually.
     */
    public List<ScoredResult> evaluateAllInParallel(
            List<JobMatchingService.ScoredJob> jobs,
            UserProfile profile,
            UUID userId,
            String sourceTag) {
        return evaluateAllLight(jobs, profile, userId, sourceTag);
    }

    // ── Private: light score ───────────────────────────────────────────────────

    private ScoredResult lightScore(
            JobMatchingService.ScoredJob rankedJob,
            UUID userId,
            String cvSummary) {

        Job job = rankedJob.job();
        UUID jobId = job.getId();

        // Cache hit
        int cached = cache.getLight(userId, jobId);
        if (cached >= 0) {
            log.debug("[Light] Cache HIT userId={} jobId={} score={}", userId, jobId, cached);
            progressStore.recordJobEvaluated(userId, job.getSourceName());
            return lightResult(job, cached);
        }

        // Build and execute light prompt via provider router
        String jd = job.getDescription() != null ? job.getDescription() : job.getTitle();
        String prompt = String.format(LIGHT_SCORE_PROMPT, cvSummary, job.getTitle(), jd);

        try {
            String rawJson = router.routePrompt(prompt, userId, "light-eval");
            int matchPercent = parseMatchPercent(rawJson);
            cache.putLight(userId, jobId, matchPercent);
            progressStore.recordJobEvaluated(userId, job.getSourceName());
            return lightResult(job, matchPercent);
        } catch (Exception e) {
            log.warn("[Light] Failed for job '{}': {}", job.getTitle(), e.getMessage());
            progressStore.recordJobEvaluated(userId, job.getSourceName());
            return ScoredResult.failed(job, mapper);
        }
    }

    private ScoredResult lightResult(Job job, int matchPercent) {
        com.fasterxml.jackson.databind.node.ObjectNode node = mapper.createObjectNode();
        node.put("matchPercent", matchPercent);
        node.put("evaluationStatus", "LIGHT");
        return new ScoredResult(job, node, matchPercent);
    }

    private int parseMatchPercent(String rawJson) {
        try {
            // Strip markdown code fences if present
            String clean = rawJson.replaceAll("```[^\\n]*\\n?", "").replaceAll("```", "").trim();
            JsonNode node = mapper.readTree(clean);
            int v = node.path("matchPercent").asInt(-1);
            return (v >= 0 && v <= 100) ? v : 50;
        } catch (Exception e) {
            // Try to find an integer in the response as fallback
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(rawJson);
            if (m.find()) {
                int v = Integer.parseInt(m.group());
                return Math.min(v, 100);
            }
            return 50;
        }
    }

    /** Build a short CV summary for the light prompt (first 600 chars). */
    private String buildCvSummary(String cvText) {
        if (cvText == null || cvText.isBlank()) return "CV not available";
        return cvText.length() > 600 ? cvText.substring(0, 600) + "..." : cvText;
    }

    // ── Private: full (deep) evaluation with retries ───────────────────────────

    private ScoredResult evaluateWithRetry(
            JobMatchingService.ScoredJob rankedJob,
            UserProfile profile,
            UUID userId,
            String cvText,
            String sourceTag) {

        Job job = rankedJob.job();

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                JsonNode report = evaluationBuilder.build(
                        userId, job, profile, cvText, rankedJob, sourceTag, "complete_local");

                EvaluationReportValidator.NormalizationResult normResult =
                        validator.normalizeOrPartial(report, sourceTag);

                JsonNode finalReport = normResult.report();

                if (!normResult.valid() && attempt < MAX_RETRIES) {
                    log.warn("[Deep eval] Attempt {}/{} partial for '{}': {}",
                            attempt, MAX_RETRIES, job.getTitle(), normResult.error());
                    continue;
                }

                JsonNode enriched = evaluationEnrichment.ensureComplete(
                        userId, job, profile, cvText, finalReport, sourceTag);

                int matchPercent = enriched.path("matchPercent").asInt(
                        enriched.path("overallScore").asInt(0));

                progressStore.recordJobEvaluated(userId, job.getSourceName());
                return new ScoredResult(job, enriched, matchPercent);

            } catch (Exception e) {
                log.warn("[Deep eval] Attempt {}/{} exception for '{}': {}",
                        attempt, MAX_RETRIES, job.getTitle(), e.getMessage());
                if (attempt < MAX_RETRIES) {
                    try { Thread.sleep(500L * attempt); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }

        log.warn("[Deep eval] All retries exhausted for job '{}' — using fallback",
                job.getTitle());
        progressStore.recordJobEvaluated(userId, job.getSourceName());
        return ScoredResult.failed(job, mapper);
    }

    // ── Result record ──────────────────────────────────────────────────────────

    public record ScoredResult(Job job, JsonNode scoreBreakdown, int matchPercent) {
        public static ScoredResult failed(Job job, ObjectMapper mapper) {
            com.fasterxml.jackson.databind.node.ObjectNode node = mapper.createObjectNode();
            node.put("evaluationStatus", "INCOMPLETE");
            node.put("matchPercent", 0);
            node.put("overallScore", 0);
            node.put("verdict", "Skip");
            node.put("humanSummary", "Evaluation could not be completed.");
            return new ScoredResult(job, node, 0);
        }
    }
}
