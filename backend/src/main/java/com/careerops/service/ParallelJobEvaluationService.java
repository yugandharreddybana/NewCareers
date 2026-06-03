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
 * Parallel job evaluation engine for the onboarding discovery pool.
 *
 * Takes the full list of scraped + deduplicated jobs and evaluates ALL of them
 * simultaneously using a dedicated IO-bound thread pool — instead of sequentially.
 *
 * Integration:
 *   Called from JobDeliveryService.deliverForOnboarding() for the discovery pool phase.
 *   Each job evaluation pushes a JOB_EVALUATED SSE event via JobEvaluationProgressStore.
 *
 * Why a dedicated executor (not the common ForkJoinPool):
 *   LLM API calls are IO-bound and can block for 5–30 seconds each.
 *   The common pool is CPU-sized and will deadlock under heavy IO load.
 *   Virtual threads (Java 21) are used here for maximum throughput.
 */
@Service
public class ParallelJobEvaluationService {

    private static final Logger log = LoggerFactory.getLogger(ParallelJobEvaluationService.class);

    private static final int MAX_RETRIES = 2;

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
    // BUG-3.005 FIX: Inject the shared Spring-managed ObjectMapper instead of calling
    // new ObjectMapper() inside ScoredResult.failed(). ObjectMapper construction is
    // expensive — under a 50-job parallel evaluation all failing, the old code created
    // 50 separate ObjectMapper instances unnecessarily.
    private final ObjectMapper mapper;

    @Value("${jobs.parallel.eval.pool.size:15}")
    private int evalPoolSize;

    // Virtual-thread executor — each LLM call gets its own lightweight virtual thread
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
            ObjectMapper mapper) {
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
    }

    @PostConstruct
    public void initExecutor() {
        // Java 21 virtual threads — perfect for IO-bound LLM calls
        // Falls back to a bounded platform thread pool if virtual threads unavailable
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

    /**
     * Evaluate all jobs in the given list in parallel.
     *
     * Each job is evaluated using the structured evaluation builder (same logic as the sequential
     * onboarding path), but all evaluations run concurrently via CompletableFuture fan-out.
     *
     * The method blocks until ALL jobs are evaluated (or timed out / failed) before returning.
     * Failed jobs are marked with evaluationStatus=INCOMPLETE and matchPercent=0 — they are
     * never silently dropped.
     *
     * @param jobs     pre-ranked jobs to evaluate
     * @param profile  the user's profile
     * @param userId   used for SSE progress events and CV lookup
     * @param sourceTag source tag for EvaluationReportValidator (e.g. "onboarding_pool_parallel")
     * @return list of (job, scoreBreakdown) pairs sorted by matchPercent descending
     */
    public List<ScoredResult> evaluateAllInParallel(
            List<JobMatchingService.ScoredJob> jobs,
            UserProfile profile,
            UUID userId,
            String sourceTag) {

        if (jobs.isEmpty()) return List.of();

        String cvText = cvService.activeCvText(userId);
        progressStore.setTotal(userId, jobs.size());
        log.info("[Parallel eval] Starting fan-out: {} jobs, userId={}", jobs.size(), userId);

        // Fan-out: launch all evaluations concurrently
        List<CompletableFuture<ScoredResult>> futures = jobs.stream()
                .map(rankedJob -> CompletableFuture
                        .supplyAsync(
                                () -> evaluateWithRetry(rankedJob, profile, userId, cvText, sourceTag),
                                evalExecutor)
                        .exceptionally(ex -> {
                            log.error("[Parallel eval] Permanent failure for job '{}': {}",
                                    rankedJob.job().getTitle(), ex.getMessage());
                            // Record progress even on failure — never block the progress bar
                            progressStore.recordJobEvaluated(userId, rankedJob.job().getSourceName());
                            return ScoredResult.failed(rankedJob.job(), mapper);
                        }))
                .collect(Collectors.toList());

        // Wait for ALL futures — dashboard never shows until everything is done
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        List<ScoredResult> results = futures.stream()
                .map(CompletableFuture::join)
                .sorted((a, b) -> Integer.compare(b.matchPercent(), a.matchPercent()))
                .collect(Collectors.toList());

        log.info("[Parallel eval] Complete: {} results for userId={}", results.size(), userId);
        return results;
    }

    // ── Private evaluation logic ─────────────────────────────────────────────

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

                // If partial/incomplete and we have retries left, retry
                if (!normResult.valid() && attempt < MAX_RETRIES) {
                    log.warn("[Parallel eval] Attempt {}/{} partial for '{}': {}",
                            attempt, MAX_RETRIES, job.getTitle(), normResult.error());
                    continue;
                }

                // Enrich to ensure all fields are present
                JsonNode enriched = evaluationEnrichment.ensureComplete(
                        userId, job, profile, cvText, finalReport, sourceTag);

                int matchPercent = enriched.path("matchPercent").asInt(
                        enriched.path("overallScore").asInt(0));

                progressStore.recordJobEvaluated(userId, job.getSourceName());
                return new ScoredResult(job, enriched, matchPercent);

            } catch (Exception e) {
                log.warn("[Parallel eval] Attempt {}/{} exception for '{}': {}",
                        attempt, MAX_RETRIES, job.getTitle(), e.getMessage());
                if (attempt < MAX_RETRIES) {
                    try { Thread.sleep(500L * attempt); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }

        // All retries exhausted — return a minimal scored result, never drop the job
        log.warn("[Parallel eval] All retries exhausted for job '{}' — using fallback score",
                job.getTitle());
        progressStore.recordJobEvaluated(userId, job.getSourceName());
        return ScoredResult.failed(job, mapper);
    }

    // ── Result record ────────────────────────────────────────────────────────

    public record ScoredResult(Job job, JsonNode scoreBreakdown, int matchPercent) {
        /**
         * Factory for failed evaluations — job is retained with 0% match and INCOMPLETE status.
         * BUG-3.005 FIX: Takes the shared ObjectMapper as a parameter instead of creating
         * a new ObjectMapper() per call (which was expensive and wasteful at scale).
         */
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
