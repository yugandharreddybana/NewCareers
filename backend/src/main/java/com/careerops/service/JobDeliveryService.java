package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.JobDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.*;
import com.careerops.repository.*;
import com.careerops.service.sources.AdzunaSource;
import com.careerops.service.sources.IndeedRssSource;
import com.careerops.service.sources.IrishJobsSource;
import com.careerops.service.sources.JobsIeSource;
import com.careerops.service.sources.JobsIrelandSource;
import com.careerops.service.sources.company.CompanyCareerSource;
import com.careerops.service.sources.LinkedInPublicSource;
import com.careerops.service.sources.JobSource;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Wires scrape -> dedup -> JobMatchingService pre-rank -> parallel AI score -> top-N -> persist.
 *
 * B1-G3 FIX: deliverScored() and tryDeliverLive() now delegate per-job AI
 * scoring to ParallelJobEvaluationService.evaluateDeep() instead of calling
 * evaluationBuilder.build() directly. evaluateDeep() is cache-aware:
 *   - Cache HIT  → returns the cached full report instantly (no AI call)
 *   - Cache MISS → runs the full StructuredJobEvaluationBuilder evaluation
 *                  and writes the result to AiEvalCacheService
 * This completes the two-tier architecture wiring in the delivery pipeline.
 *
 * NOTE: deliverForOnboarding() and persistDiscoveryPoolHeuristic() intentionally
 * keep the direct evaluationBuilder.build() path — onboarding evaluations are
 * always fresh (cache is not appropriate at that stage).
 *
 * FIX (DB-001): All inserts go through upsertUserJob() which uses a
 * try/catch on DataIntegrityViolationException to handle concurrent-insert races.
 */
@Service
@SuppressWarnings("all")
public class JobDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(JobDeliveryService.class);

    private final JobScrapeService               scrape;
    private final DeduplicationService           dedup;
    private final NvidiaService                  nvidia;
    private final SkillPromptLibrary             prompts;
    private final UserProfileRepository          profiles;
    private final UserJobRepository              userJobs;
    private final JobRepository                  jobs;
    private final CvService                      cvService;
    private final DailyLimitService              limits;
    private final JobMatchingService             matcher;
    private final ObjectMapper                   mapper;
    private final TransactionTemplate            transactionTemplate;
    private final EvaluationReportValidator      evaluationValidator;
    private final StructuredJobEvaluationBuilder evaluationBuilder;
    private final EvaluationReportEnrichmentService evaluationEnrichment;
    private final ParallelJobEvaluationService   parallelEval;   // B1-G3
    private final ProfileReadableFields          profileFields;
    private final AdzunaSource                   adzuna;
    private final IndeedRssSource                indeed;
    private final IrishJobsSource                irishJobs;
    private final JobsIeSource                   jobsIe;
    private final JobsIrelandSource              jobsIreland;
    private final CompanyCareerSource            companyPages;
    private final LinkedInPublicSource           linkedInPublic;

    private final JobFetchSettings fetchSettings;
    private final CachedJobPoolService cachedJobPool;

    @Value("${jobs.gemini.prerank.pool:25}")
    private int preRankPool;

    @Value("${jobs.onboarding.use-cached-pool:true}")
    private boolean useCachedPool;

    @Value("${jobs.cached-pool.fetch-cap:500}")
    private int cachedPoolFetchCap;

    @Value("${jobs.onboarding.heuristic-fallback:false}")
    private boolean onboardingHeuristicFallback;

    @Value("${jobs.onboarding.persist-discovery-pool:true}")
    private boolean persistDiscoveryPool;

    @Value("${jobs.onboarding.discovery-pool-cap:200}")
    private int discoveryPoolCap;

    private int profileMinMatchFloor(UserProfile profile) {
        return JobProfileMatchPolicy.minMatchFloor(profile);
    }

    public JobDeliveryService(JobScrapeService scrape, DeduplicationService dedup,
                              NvidiaService nvidia, SkillPromptLibrary prompts,
                              UserProfileRepository profiles, UserJobRepository userJobs,
                              JobRepository jobs,
                              CvService cv, DailyLimitService limits,
                              JobMatchingService matcher, ObjectMapper mapper,
                              PlatformTransactionManager transactionManager,
                              EvaluationReportValidator evaluationValidator,
                              StructuredJobEvaluationBuilder evaluationBuilder,
                              EvaluationReportEnrichmentService evaluationEnrichment,
                              ParallelJobEvaluationService parallelEval,
                              ProfileReadableFields profileFields,
                              AdzunaSource adzuna,
                              IndeedRssSource indeed,
                              IrishJobsSource irishJobs,
                              JobsIeSource jobsIe,
                              JobsIrelandSource jobsIreland,
                              CompanyCareerSource companyPages,
                              LinkedInPublicSource linkedInPublic,
                              JobFetchSettings fetchSettings,
                              CachedJobPoolService cachedJobPool) {
        this.scrape              = scrape;    this.dedup    = dedup;    this.nvidia   = nvidia;
        this.prompts             = prompts;   this.profiles = profiles; this.userJobs = userJobs;
        this.jobs                = jobs;
        this.cvService           = cv;        this.limits   = limits;   this.matcher  = matcher;
        this.mapper              = mapper;
        this.evaluationValidator = evaluationValidator;
        this.evaluationBuilder   = evaluationBuilder;
        this.evaluationEnrichment = evaluationEnrichment;
        this.parallelEval        = parallelEval;
        this.profileFields       = profileFields;
        this.adzuna              = adzuna;   this.indeed   = indeed;
        this.irishJobs           = irishJobs; this.jobsIe   = jobsIe;
        this.jobsIreland         = jobsIreland; this.companyPages = companyPages;
        this.linkedInPublic      = linkedInPublic;
        this.fetchSettings       = fetchSettings;
        this.cachedJobPool       = cachedJobPool;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /**
     * Whether first-run onboarding will query {@code careerops.jobs} instead of external boards.
     * Used by {@link OnboardingDeliveryService} for progress copy.
     */
    public boolean willUseCachedPoolForOnboarding(UUID userId) {
        return useCachedPool && isFirstDelivery(userId);
    }

    // TODO: users who delete all pipeline jobs also qualify — acceptable for v1.
    private boolean isFirstDelivery(UUID userId) {
        return userJobs.countByUserIdAndDeletedAtIsNull(userId) == 0;
    }

    private List<Job> applyDeliveryFilters(List<Job> raw, UserProfile profile) {
        return JobDeliveryFilters.applyPipelineFilters(raw, fetchSettings.maxAgeDays(), profile);
    }

    /**
     * Unified live fetch: tries sources in profile-preference order.
     * Uses structured local scoring (not evaluateDeep) so the request finishes within the HTTP timeout.
     */
    @Transactional(timeout = 120)
    public JobCardResponse deliverOneLiveMatch(UUID userId) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete your profile first"));

        List<String> errors = new ArrayList<>();
        JobCardResponse result;

        if (profilePrefersIreland(p)) {
            result = tryDeliverLive(userId, p, irishJobs,    "irishjobs_live",    errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, jobsIe,       "jobsie_live",       errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, jobsIreland,  "jobsireland_live",  errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, indeed,       "indeed_live",       errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, adzuna,       "adzuna_live",       errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, companyPages, "company_pages_live",errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, linkedInPublic,"linkedin_public_live",errors); if (result != null) return result;
        } else {
            result = tryDeliverLive(userId, p, adzuna,       "adzuna_live",       errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, companyPages, "company_pages_live",errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, indeed,       "indeed_live",       errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, irishJobs,    "irishjobs_live",    errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, jobsIe,       "jobsie_live",       errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, jobsIreland,  "jobsireland_live",  errors); if (result != null) return result;
            result = tryDeliverLive(userId, p, linkedInPublic,"linkedin_public_live",errors); if (result != null) return result;
        }

        String detail = errors.isEmpty()
            ? "No live jobs available from any source right now."
            : String.join(" ", errors);
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, detail);
    }

    private static boolean profilePrefersIreland(UserProfile profile) {
        if (profile == null) return false;
        String loc = ((profile.getLocation() == null ? "" : profile.getLocation()) + " " +
                      (profile.getGoalLocation() == null ? "" : profile.getGoalLocation())).toLowerCase();
        return loc.contains("ireland") || loc.contains("dublin") || loc.contains("cork")
            || loc.contains("galway") || loc.contains("limerick") || loc.contains("belfast")
            || loc.contains("waterford") || loc.contains("kilkenny") || loc.contains("donegal");
    }

    /**
     * B1-G3: uses evaluateDeep() for AI scoring so the result is cached
     * and subsequent opens of the same job card are served from AiEvalCacheService.
     */
    private @Nullable JobCardResponse tryDeliverLive(
            UUID userId, UserProfile p, JobSource source, String sourceTag, List<String> errors) {
        if (!source.hasBudget()) {
            errors.add(source.name() + " unavailable (quota/API key).");
            return null;
        }
        List<Job> raw;
        long timeoutSec = source instanceof CompanyCareerSource ? 120 : 8;
        try {
            raw = java.util.concurrent.CompletableFuture.supplyAsync(() -> source.fetch(p))
                .orTimeout(timeoutSec, java.util.concurrent.TimeUnit.SECONDS)
                .exceptionally(ex -> {
                    log.warn("Live fetch from {} timed out: {}", source.name(), ex.getMessage());
                    return java.util.List.of();
                })
                .join();
        } catch (Exception e) {
            log.warn("Live fetch from {} failed: {}", source.name(), e.getMessage());
            errors.add(source.name() + " failed: " + e.getMessage());
            return null;
        }
        if (raw.isEmpty()) { errors.add(source.name() + " returned no jobs."); return null; }

        raw = applyDeliveryFilters(raw, p);
        if (raw.isEmpty()) { errors.add(source.name() + " returned no jobs after profile/location filters."); return null; }

        List<Job> deduped = dedup.dedupForPipelineDelivery(userId, raw);
        List<JobMatchingService.ScoredJob> ranked = matcher.topN(
            deduped.stream().filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList(),
            p, 5);
        if (ranked.isEmpty()) { errors.add(source.name() + " jobs didn't match profile filters."); return null; }

        ranked = prioritizeByProfileLocation(ranked, p);
        int minPct = profileMinMatchFloor(p);

        for (JobMatchingService.ScoredJob candidate : ranked) {
            Job j = candidate.job();
            if (userJobs.findByUserIdAndJobId(userId, j.getId()).isPresent()) continue;

            String cvText = cvService.activeCvText(userId);
            Scored scored = structuredScore(userId, j, candidate, p, cvText, minPct, sourceTag);

            if (!passesProfileMinMatch(scored.match(), p)) continue;
            if (!titleMatchesDesiredRoles(p, j)) continue;

            boolean inserted = upsertUserJob(userId, scored);
            if (!inserted) continue;
            dedup.markSeen(userId, List.of(j));
            UserJob saved = userJobs.findByUserIdAndJobId(userId, j.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save live job"));
            log.info("Live match from {} delivered userId={} jobId={} title={}",
                source.name(), userId, j.getId(), j.getTitle());
            return JobCardResponse.from(saved, j);
        }

        errors.add(source.name() + " could not persist any match.");
        return null;
    }

    /** @deprecated use {@link #deliverOneLiveMatch} instead */
    @Transactional(timeout = 30)
    public JobCardResponse deliverOneLiveAdzunaMatch(UUID userId) { return deliverOneLiveMatch(userId); }

    /** @deprecated use {@link #deliverOneLiveMatch} instead */
    @Transactional(timeout = 30)
    public JobCardResponse deliverOneLiveIndeedMatch(UUID userId) { return deliverOneLiveMatch(userId); }

    public FetchSummary deliverFromIrishJobs(UUID userId, int desiredCount) {
        if (!irishJobs.hasBudget())
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IrishJobs source unavailable.");
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first"));
        List<Job> raw = applyDeliveryFilters(fetchSourceWithTimeout(irishJobs, p), p);
        if (raw.isEmpty())
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IrishJobs returned no listings right now.");
        log.info("User {} IrishJobs raw fetch: {} jobs", userId, raw.size());
        return deliverScored(userId, p, raw, desiredCount, "irishjobs_delivery");
    }

    @SuppressWarnings("unchecked")
    public FetchSummary deliver(UUID userId, int desiredCount) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first"));
        List<Job> raw = applyDeliveryFilters(scrape.fetchRaw(p), p);
        logSourceMix(userId, raw);
        return deliverScored(userId, p, raw, desiredCount, "daily_delivery");
    }

    /**
     * Phase 1 nightly cron: scrape, dedup, heuristic pre-rank, persist without AI scoring.
     */
    public void fetchAndStoreOnly(UUID userId) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new RuntimeException("Profile not found: " + userId));
        List<Job> raw = applyDeliveryFilters(scrape.fetchRaw(p), p);
        logSourceMix(userId, raw);
        List<Job> deduped = dedup.dedupForPipelineDelivery(userId, raw);
        if (deduped.isEmpty()) {
            log.info("fetchAndStoreOnly: no new raw jobs for userId={}", userId);
            return;
        }
        int poolLimit = Math.max(batchSize() * 5, preRankPool);
        List<JobMatchingService.ScoredJob> ranked = matcher.topN(
            deduped.stream().filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList(),
            p, poolLimit);
        int stored = 0;
        List<Job> newlyStored = new ArrayList<>();
        for (JobMatchingService.ScoredJob candidate : ranked) {
            Job j = candidate.job();
            if (userJobs.findByUserIdAndJobId(userId, j.getId()).isPresent()) continue;
            if (!titleMatchesDesiredRoles(p, j)) continue;
            boolean inserted = transactionTemplate.execute(
                status -> insertHeuristicUserJob(userId, j, candidate.score()));
            if (Boolean.TRUE.equals(inserted)) {
                stored++;
                newlyStored.add(j);
            }
        }
        if (!newlyStored.isEmpty()) dedup.markSeen(userId, newlyStored);
        log.info("fetchAndStoreOnly: stored {} raw jobs for userId={}", stored, userId);
    }

    /**
     * Phase 2 nightly cron: AI-score jobs stored in Phase 1 (cache-aware evaluateDeep).
     */
    public void scoreStoredJobs(UUID userId, int desiredCount) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new RuntimeException("Profile not found: " + userId));
        int remaining = limits.remaining(userId);
        if (remaining <= 0) {
            log.info("scoreStoredJobs: daily limit reached for userId={}", userId);
            return;
        }
        int target = Math.min(desiredCount, remaining);
        List<UserJob> unscored = userJobs.findUnscoredByUserId(userId, PageRequest.of(0, target));
        if (unscored.isEmpty()) {
            log.info("scoreStoredJobs: no unscored jobs for userId={}", userId);
            return;
        }
        int scored = 0;
        for (UserJob uj : unscored) {
            try {
                Job j = jobs.findById(uj.getJobId()).orElse(null);
                if (j == null) continue;
                JobMatchingService.ScoredJob candidate = new JobMatchingService.ScoredJob(
                    j,
                    uj.getMatchPercent() != null ? uj.getMatchPercent() : 0,
                    List.of(),
                    List.of());
                ParallelJobEvaluationService.ScoredResult deep =
                    parallelEval.evaluateDeep(candidate, p, userId, "nightly_score");
                transactionTemplate.executeWithoutResult(status -> {
                    applyScoredToUserJob(uj, new Scored(j, deep.scoreBreakdown(), deep.matchPercent()));
                    userJobs.save(uj);
                });
                scored++;
                if (scored >= target) break;
            } catch (Exception ex) {
                log.warn("scoreStoredJobs: scoring failed for userJobId={}: {}", uj.getId(), ex.getMessage());
            }
        }
        if (scored > 0) limits.increment(userId, scored);
        log.info("scoreStoredJobs: scored {} jobs for userId={}", scored, userId);
    }

    private static boolean titleMatchesDesiredRoles(UserProfile profile, Job job) {
        return job != null && JobDeliveryFilters.titleMatchesDesiredRoles(profile, job.getTitle());
    }

    private static boolean passesProfileMinMatch(int matchPercent, UserProfile profile) {
        return JobProfileMatchPolicy.meetsMinMatch(matchPercent, profile);
    }

    private static void logSourceMix(UUID userId, List<Job> raw) {
        Map<String, Long> bySource = raw.stream()
            .collect(Collectors.groupingBy(
                j -> j.getSourceName() != null && !j.getSourceName().isBlank() ? j.getSourceName() : "unknown",
                Collectors.counting()));
        log.info("User {} scrape raw total={} by source={}", userId, raw.size(), bySource);
    }

    /**
     * B1-G3: per-candidate scoring now routes through evaluateDeep() so
     * results land in AiEvalCacheService and are served from cache on job-open.
     */
    private FetchSummary deliverScored(UUID userId, UserProfile p, List<Job> raw, int desiredCount, String sourceTag) {
        if (Boolean.FALSE.equals(p.getOnboarded()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first");
        int remaining = limits.remaining(userId);
        if (remaining <= 0)
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, JobFetchSettings.dailyLimitMessage());
        int target = Math.min(desiredCount, remaining);

        List<Job> deduped = dedup.dedupForPipelineDelivery(userId, raw);
        int poolLimit = Math.max(target * 5, preRankPool);
        List<JobMatchingService.ScoredJob> preRankedCandidates = matcher.topN(
            deduped.stream().filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList(),
            p, poolLimit);
        log.info("User {} pre-ranked {} candidates (target {} new)", userId, preRankedCandidates.size(), target);
        if (preRankedCandidates.isEmpty())
            return new FetchSummary(0, limits.getCount(userId), limits.maxForUser(userId), limits.remaining(userId));

        int minPct = profileMinMatchFloor(p);
        Set<String> companies = new HashSet<>();
        List<Scored> toPersist = new ArrayList<>();

        for (JobMatchingService.ScoredJob candidate : preRankedCandidates) {
            if (toPersist.size() >= target) break;
            if (!titleMatchesDesiredRoles(p, candidate.job())) continue;
            Job j = candidate.job();
            if (userJobs.findByUserIdAndJobId(userId, j.getId()).isPresent()) continue;
            if (!companies.add(normalizeCompany(j.getCompany()))) continue;

            // B1-G3: route through evaluateDeep() — cache-aware full evaluation
            ParallelJobEvaluationService.ScoredResult deep =
                    parallelEval.evaluateDeep(candidate, p, userId, sourceTag);
            Scored scored = new Scored(j, deep.scoreBreakdown(), deep.matchPercent());

            if (!passesProfileMinMatch(scored.match(), p)) continue;
            toPersist.add(scored);
        }

        Integer saved = transactionTemplate.execute(status -> persistResults(userId, toPersist));
        int delivered = saved == null ? 0 : saved;
        log.info("User {} delivered {} new jobs (tag {})", userId, delivered, sourceTag);
        return new FetchSummary(delivered, limits.getCount(userId), limits.maxForUser(userId), limits.remaining(userId));
    }

    private List<Job> fetchSourceWithTimeout(JobSource source, UserProfile profile) {
        try {
            return CompletableFuture.supplyAsync(() -> source.fetch(profile))
                .orTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .exceptionally(ex -> { log.warn("Fetch from {} timed out: {}", source.name(), ex.getMessage()); return List.of(); })
                .join();
        } catch (Exception e) {
            log.warn("Fetch from {} failed: {}", source.name(), e.getMessage());
            return List.of();
        }
    }

    public int deliverForOnboarding(
            UUID userId, int targetCount, int minRequired,
            Consumer<OnboardingDeliveryProgress> onProgress) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first"));
        if (Boolean.FALSE.equals(p.getOnboarded()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first");
        if (cvService.activeCvText(userId).isBlank())
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload your CV before job matching");

        boolean cachedPath = willUseCachedPoolForOnboarding(userId);
        List<Job> raw;
        if (cachedPath) {
            raw = cachedJobPool.loadCandidates(p, cachedPoolFetchCap);
            log.info("Onboarding user {} cached pool: {} candidates", userId, raw.size());
        } else {
            raw = applyDeliveryFilters(scrape.fetchRaw(p), p);
            logSourceMix(userId, raw);
        }
        return deliverForOnboardingFromPool(userId, p, raw, targetCount, minRequired, onProgress, cachedPath);
    }

    private int deliverForOnboardingFromPool(
            UUID userId, UserProfile p, List<Job> raw,
            int targetCount, int minRequired,
            Consumer<OnboardingDeliveryProgress> onProgress,
            boolean cachedPath) {
        List<Job> deduped = dedup.dedupForPipelineDelivery(userId, raw);
        log.info("Onboarding user {} dedup pool size: {}", userId, deduped.size());

        String cvText = cvService.activeCvText(userId);
        int minPct = profileMinMatchFloor(p);
        int poolSaved = 0;
        if (persistDiscoveryPool && !deduped.isEmpty()) {
            // Onboarding pool: intentionally uses evaluationBuilder directly (not cache)
            poolSaved = persistDiscoveryPoolHeuristic(userId, deduped, p, minPct, cvText);
            log.info("Onboarding user {} discovery pool saved {} jobs (cap {})", userId, poolSaved, discoveryPoolCap);
            if (poolSaved > 0) dedup.markSeen(userId, deduped.stream().limit(discoveryPoolCap).toList());
        }

        onProgress.accept(new OnboardingDeliveryProgress(
            com.careerops.dto.OnboardingDeliveryDtos.Stage.evaluating_jobs,
            poolSaved > 0
                ? poolSaved + " roles added to your pipeline — refining top matches with AI…"
                : "Evaluating role fit with AI…",
            poolSaved, targetCount, minRequired, deduped.size(), null));

        int evaluated = poolSaved;
        if (evaluated >= targetCount) {
            onProgress.accept(new OnboardingDeliveryProgress(
                com.careerops.dto.OnboardingDeliveryDtos.Stage.ready,
                poolSaved + " roles are in your pipeline",
                evaluated, targetCount, minRequired, deduped.size(), null));
            return evaluated;
        }

        int onboardingPool = Math.min(preRankPool, 12);
        List<JobMatchingService.ScoredJob> ranked = matcher.topN(
            deduped.stream().filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList(),
            p, onboardingPool);
        List<Job> preRanked = ranked.stream().map(JobMatchingService.ScoredJob::job).toList();

        if (preRanked.isEmpty()) {
            com.careerops.dto.OnboardingDeliveryDtos.Stage terminal = evaluated >= minRequired
                ? com.careerops.dto.OnboardingDeliveryDtos.Stage.ready_partial
                : com.careerops.dto.OnboardingDeliveryDtos.Stage.failed;
            String msg = evaluated > 0 ? evaluated + " roles in your pipeline" : "No new roles found in your filters yet";
            onProgress.accept(new OnboardingDeliveryProgress(terminal, msg, evaluated, targetCount, minRequired, deduped.size(), null));
            return evaluated;
        }

        String systemPrompt = prompts.buildFullSystemPrompt("evaluate");
        Set<String> companies = new HashSet<>();
        List<Job> persistedJobs = new ArrayList<>();

        for (JobMatchingService.ScoredJob rankedJob : ranked) {
            if (evaluated >= targetCount) break;
            if (!titleMatchesDesiredRoles(p, rankedJob.job())) continue;
            Job j = rankedJob.job();
            try {
                Scored scored = scoreOnboardingJob(j, rankedJob, p, cvText, systemPrompt, userId, minPct);
                int match = scored.match();
                if (!passesProfileMinMatch(match, p)) continue;
                String companyKey = normalizeCompany(j.getCompany());
                if (!companies.add(companyKey)) continue;
                boolean inserted = transactionTemplate.execute(status -> upsertUserJob(userId, scored));
                if (Boolean.TRUE.equals(inserted)) {
                    persistedJobs.add(j);
                    evaluated++;
                }
                com.careerops.dto.OnboardingDeliveryDtos.Stage stage =
                    evaluated >= minRequired
                        ? (evaluated >= targetCount
                            ? com.careerops.dto.OnboardingDeliveryDtos.Stage.ready
                            : com.careerops.dto.OnboardingDeliveryDtos.Stage.ready_partial)
                        : com.careerops.dto.OnboardingDeliveryDtos.Stage.evaluating_jobs;
                String msg = evaluated >= minRequired
                    ? "Your top matches are ready (" + evaluated + " evaluated)"
                    : "Evaluating matches (" + evaluated + " of " + minRequired + " minimum)…";
                onProgress.accept(new OnboardingDeliveryProgress(
                    stage, msg, evaluated, targetCount, minRequired, deduped.size(), null));
                if (evaluated >= minRequired) break;
            } catch (Exception ex) {
                log.warn("Onboarding scoring failed for job {}: {}", j.getId(), ex.getMessage());
            }
            if (!cachedPath) {
                try { Thread.sleep(400); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
            }
        }

        if (!persistedJobs.isEmpty()) dedup.markSeen(userId, persistedJobs);
        return evaluated;
    }

    // ── FIX DB-001: Atomic upsert ────────────────────────────────────────────

    /** Inserts heuristic pre-rank only — scoreBreakdown left null for Phase 2 AI scoring. */
    private boolean insertHeuristicUserJob(UUID userId, Job job, int matchPercent) {
        UUID jobId = job.getId();
        if (userJobs.findByUserIdAndJobId(userId, jobId).isPresent()) {
            return false;
        }
        if (userJobs.findRowIdByUserIdAndJobIdIncludingDeleted(userId, jobId).isPresent()) {
            userJobs.reactivateSoftDeleted(userId, jobId);
            Optional<UserJob> restored = userJobs.findByUserIdAndJobId(userId, jobId);
            if (restored.isPresent()) {
                UserJob uj = restored.get();
                uj.setMatchPercent(matchPercent);
                uj.setScoreBreakdown(null);
                userJobs.save(uj);
                return true;
            }
        }
        try {
            UserJob uj = UserJob.builder()
                .userId(userId)
                .jobId(jobId)
                .matchPercent(matchPercent)
                .scoreBreakdown(null)
                .build();
            userJobs.save(uj);
            return true;
        } catch (RuntimeException ex) {
            if (isDuplicateUserJob(ex)) {
                return false;
            }
            throw ex;
        }
    }

    private boolean upsertUserJob(UUID userId, Scored s) {
        UUID jobId = s.job().getId();
        Optional<UserJob> active = userJobs.findByUserIdAndJobId(userId, jobId);
        if (active.isPresent()) {
            applyScoredToUserJob(active.get(), s);
            userJobs.save(active.get());
            log.debug("[upsert] Updated existing userId={} jobId={}", userId, jobId);
            return false;
        }
        if (userJobs.findRowIdByUserIdAndJobIdIncludingDeleted(userId, jobId).isPresent()) {
            userJobs.reactivateSoftDeleted(userId, jobId);
            Optional<UserJob> restored = userJobs.findByUserIdAndJobId(userId, jobId);
            if (restored.isPresent()) {
                applyScoredToUserJob(restored.get(), s);
                userJobs.save(restored.get());
                log.debug("[upsert] Restored soft-deleted userId={} jobId={}", userId, jobId);
                return true;
            }
        }
        try {
            UserJob uj = UserJob.builder()
                .userId(userId).jobId(jobId)
                .matchPercent(s.match())
                .aiScore(s.json().path("overallScore").asInt(s.match()))
                .matchedSkills(toArr(s.json().path("matchedSkills")))
                .unmatchedSkills(toArr(s.json().path("unmatchedSkills")))
                .cvImprovementTips(toArr(s.json().path("cvImprovementTips")))
                .humanSummary(s.json().path("humanSummary").asText(null))
                .verdict(s.json().path("verdict").asText(null))
                .scoreBreakdown(s.json())
                .build();
            userJobs.save(uj);
            return true;
        } catch (RuntimeException ex) {
            if (isDuplicateUserJob(ex)) {
                log.debug("[upsert] Concurrent insert for userId={} jobId={} — ignored", userId, jobId);
                return false;
            }
            throw ex;
        }
    }

    private static void applyScoredToUserJob(UserJob uj, Scored s) {
        uj.setMatchPercent(s.match());
        uj.setAiScore(s.json().path("overallScore").asInt(s.match()));
        uj.setMatchedSkills(toArr(s.json().path("matchedSkills")));
        uj.setUnmatchedSkills(toArr(s.json().path("unmatchedSkills")));
        uj.setCvImprovementTips(toArr(s.json().path("cvImprovementTips")));
        uj.setHumanSummary(s.json().path("humanSummary").asText(null));
        uj.setVerdict(s.json().path("verdict").asText(null));
        uj.setScoreBreakdown(s.json());
        if (uj.getDeletedAt() != null) {
            uj.setDeletedAt(null);
        }
    }

    private static boolean isDuplicateUserJob(Throwable error) {
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (t instanceof org.springframework.dao.DataIntegrityViolationException) {
                return true;
            }
            String msg = t.getMessage();
            if (msg != null && msg.contains("user_jobs_user_id_job_id_key")) {
                return true;
            }
        }
        return false;
    }

    /** @deprecated call upsertUserJob() directly */
    private void persistSingle(UUID userId, Scored s) { upsertUserJob(userId, s); }

    protected int persistResults(UUID userId, List<Scored> top) {
        List<Job> newlySaved = new ArrayList<>();
        for (Scored s : top) {
            boolean inserted = upsertUserJob(userId, s);
            if (inserted) newlySaved.add(s.job());
        }
        if (!newlySaved.isEmpty()) {
            dedup.markSeen(userId, newlySaved);
            limits.increment(userId, newlySaved.size());
        }
        return newlySaved.size();
    }

    public int batchSize() { return fetchSettings.batchSize(); }

    private String buildPrompt(Job j, UserProfile p, @Nullable String cv) {
        String headline = profileFields.goalTitle(p);
        if (headline == null) headline = "—";
        return String.format("""
            USER:
            - Professional headline: %s
            - Target roles: %s
            - Tech stack: %s
            - Sectors: %s
            - Location: %s
            - Salary band: %s-%s EUR
            - Sponsorship required: %s
            - Min match threshold: %s%%

            CV:
            %s

            JOB:
            Title: %s | Company: %s | Location: %s
            Salary: %s-%s | Sponsorship: %s
            Description:
            %s
            """,
            headline,
            arr(p.getTargetRoles()), arr(p.getTechStack()), arr(p.getSectors()),
            p.getLocation(), p.getSalaryMin(), p.getSalaryMax(),
            p.getSponsorshipRequired(), p.getMinMatchPercent(),
            trim(cv, 6000),
            j.getTitle(), j.getCompany(), j.getLocation(),
            j.getSalaryMin(), j.getSalaryMax(), j.getSponsorship(),
            trim(j.getDescription(), 4000));
    }

    private int persistDiscoveryPoolHeuristic(
            UUID userId, List<Job> deduped, UserProfile p, int minPct, String cvText) {
        // Onboarding path: intentionally bypasses evaluateDeep() cache — always fresh
        List<Job> candidates = deduped.stream()
            .filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList();
        if (candidates.isEmpty()) return 0;
        int cap = Math.max(1, discoveryPoolCap);
        List<JobMatchingService.ScoredJob> ranked = matcher.topN(candidates, p, Math.min(cap, candidates.size()));
        int saved = 0;
        for (JobMatchingService.ScoredJob rankedJob : ranked) {
            Job j = rankedJob.job();
            JsonNode report = evaluationBuilder.build(userId, j, p, cvText, rankedJob, "onboarding_pool", "complete_local");
            Scored scored = toScored(j, report, "onboarding_pool");
            if (!passesProfileMinMatch(scored.match(), p)) continue;
            if (!titleMatchesDesiredRoles(p, j)) continue;
            boolean inserted = transactionTemplate.execute(status -> upsertUserJob(userId, scored));
            if (Boolean.TRUE.equals(inserted)) saved++;
        }
        return saved;
    }

    private Scored scoreOnboardingJob(
            Job j, JobMatchingService.ScoredJob rankedJob,
            UserProfile p, String cvText, String systemPrompt,
            UUID userId, int minPct) {
        JsonNode json;
        try {
            json = nvidia.generateJson(systemPrompt, buildPrompt(j, p, cvText), userId, "job-match");
        } catch (Exception apiEx) {
            if (!onboardingHeuristicFallback) throw apiEx;
            log.warn("Onboarding heuristic fallback for job {} after: {}", j.getId(), apiEx.getMessage());
            return structuredScore(userId, j, rankedJob, p, cvText, minPct, "onboarding_heuristic");
        }
        Scored scored = toScored(j, json, "onboarding_delivery");
        boolean partial = "partial".equals(scored.json().path("evaluationStatus").asText(null));
        boolean belowMin = !passesProfileMinMatch(scored.match(), p);
        if (onboardingHeuristicFallback && (partial || belowMin || !evaluationEnrichment.isCompleteReport(scored.json()))) {
            log.warn("Onboarding structured fallback for job {} after {} match {}% (min {}%)",
                j.getId(), partial ? "partial" : "low", scored.match(), minPct);
            return structuredScore(userId, j, rankedJob, p, cvText, minPct, "onboarding_heuristic");
        }
        JsonNode full = evaluationEnrichment.ensureComplete(userId, j, p, cvText, scored.json(), "onboarding_delivery");
        return new Scored(j, full, full.path("matchPercent").asInt(scored.match()));
    }

    private Scored structuredScore(
            UUID userId, Job j, JobMatchingService.ScoredJob rankedJob,
            UserProfile p, String cvText, int minPct, String source) {
        JsonNode report = evaluationBuilder.build(userId, j, p, cvText, rankedJob, source, "complete_local");
        return toScored(j, report, source);
    }

    private Scored toScored(Job j, JsonNode raw, String source) {
        var norm = evaluationValidator.normalizeOrPartial(raw, source);
        JsonNode report = norm.report();
        int match = report.path("matchPercent").asInt(raw.path("matchPercent").asInt(0));
        if (!norm.valid()) log.warn("Evaluation partial for job {}: {}", j.getId(), norm.error());
        return new Scored(j, report, match);
    }

    private static String[] toArr(@Nullable JsonNode n) {
        if (n == null || !n.isArray()) return new String[0];
        List<String> out = new ArrayList<>();
        n.forEach(x -> out.add(x.asText()));
        return out.toArray(new String[0]);
    }
    private static String arr(String[] a) {
        return a == null ? "[]" : Arrays.stream(a).collect(Collectors.joining(", ", "[", "]"));
    }
    private static String trim(@Nullable String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...[truncated]";
    }

    private static List<JobMatchingService.ScoredJob> prioritizeByProfileLocation(
            List<JobMatchingService.ScoredJob> ranked, UserProfile p) {
        String hint = ((p.getLocation() == null ? "" : p.getLocation()) + " "
            + (p.getGoalLocation() == null ? "" : p.getGoalLocation())).toLowerCase();
        if (!hint.contains("ireland") && !hint.contains("dublin") && !hint.contains("cork")
                && !hint.contains("belfast") && !hint.contains("galway")) return ranked;
        return ranked.stream()
            .sorted(Comparator
                .comparingInt((JobMatchingService.ScoredJob s) -> locationAffinityScore(s.job(), hint))
                .reversed()
                .thenComparingInt(JobMatchingService.ScoredJob::score).reversed())
            .toList();
    }

    private static int locationAffinityScore(Job j, String hint) {
        String loc = j.getLocation() == null ? "" : j.getLocation().toLowerCase();
        int score = 0;
        if (loc.contains("ireland")) score += 30;
        if (loc.contains("dublin") && hint.contains("dublin")) score += 25;
        if (loc.contains("cork") && hint.contains("cork")) score += 20;
        if (loc.contains("belfast")) score += 15;
        if (loc.contains("remote")) score += 10;
        return score;
    }

    private static String normalizeCompany(@Nullable String name) {
        if (name == null) return "";
        String clean = name.toLowerCase()
            .replaceAll("\\s+(ltd|limited|inc|incorporated|gmbh|plc|corp|corporation|llc|s\\.a|s\\.r\\.l|co\\.|company|group)\\b", "")
            .replaceAll("[^a-z0-9]", "").trim();
        return clean.isEmpty() ? name.toLowerCase() : clean;
    }

    private record Scored(Job job, JsonNode json, int match) {}
}
