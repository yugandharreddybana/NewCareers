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
import com.careerops.service.sources.JsoupCompanySource;
import com.careerops.service.sources.LinkedInPublicSource;
import com.careerops.service.sources.JobSource;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Wires scrape -> dedup -> JobMatchingService pre-rank -> parallel NvidiaService score -> top-N -> persist.
 *
 * AI engine migrated from GeminiService to NvidiaService (NVIDIA NIM, OpenAI-compatible).
 * Output contract is identical: generateJsonAsync returns a JsonNode with matchPercent, overallScore, etc.
 */
@Service
@SuppressWarnings("all")
public class JobDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(JobDeliveryService.class);

    private final JobScrapeService      scrape;
    private final DeduplicationService  dedup;
    private final NvidiaService         nvidia;
    private final SkillPromptLibrary    prompts;
    private final UserProfileRepository profiles;
    private final UserJobRepository     userJobs;
    private final CvService             cvService;
    private final DailyLimitService     limits;
    private final JobMatchingService    matcher;
    private final ObjectMapper          mapper;
    private final TransactionTemplate   transactionTemplate;
    private final EvaluationReportValidator evaluationValidator;
    private final AdzunaSource              adzuna;
    private final IndeedRssSource           indeed;
    private final IrishJobsSource           irishJobs;
    private final JobsIeSource              jobsIe;
    private final JobsIrelandSource         jobsIreland;
    private final JsoupCompanySource        companyPages;
    private final LinkedInPublicSource      linkedInPublic;

    @Value("${jobs.cron.daily.count:3}")
    private int cronShare;

    @Value("${jobs.gemini.prerank.pool:25}")
    private int preRankPool;

    @Value("${jobs.onboarding.heuristic-fallback:false}")
    private boolean onboardingHeuristicFallback;

    public JobDeliveryService(JobScrapeService scrape, DeduplicationService dedup,
                              NvidiaService nvidia, SkillPromptLibrary prompts,
                              UserProfileRepository profiles, UserJobRepository userJobs,
                              CvService cv, DailyLimitService limits,
                              JobMatchingService matcher, ObjectMapper mapper,
                              PlatformTransactionManager transactionManager,
                              EvaluationReportValidator evaluationValidator,
                              AdzunaSource adzuna,
                              IndeedRssSource indeed,
                              IrishJobsSource irishJobs,
                              JobsIeSource jobsIe,
                              JobsIrelandSource jobsIreland,
                              JsoupCompanySource companyPages,
                              LinkedInPublicSource linkedInPublic) {
        this.scrape   = scrape;    this.dedup    = dedup;    this.nvidia   = nvidia;
        this.prompts  = prompts;   this.profiles = profiles; this.userJobs = userJobs;
        this.cvService = cv;       this.limits   = limits;   this.matcher  = matcher;
        this.mapper   = mapper;
        this.evaluationValidator = evaluationValidator;
        this.adzuna   = adzuna;   this.indeed   = indeed;
        this.irishJobs = irishJobs; this.jobsIe = jobsIe;
        this.jobsIreland = jobsIreland; this.companyPages = companyPages;
        this.linkedInPublic = linkedInPublic;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /**
     * Unified live fetch: tries Irish-focused sources first when the profile
     * indicates Ireland, then Adzuna, then the remaining free sources.
     * Pre-ranks against the user profile, persists the best match, and returns it.
     * Uses heuristic scoring (no NVIDIA) so the call is fast and reliable.
     */
    @Transactional(timeout = 45)
    public JobCardResponse deliverOneLiveMatch(UUID userId) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete your profile first"));

        List<String> errors = new ArrayList<>();
        JobCardResponse result;

        if (profilePrefersIreland(p)) {
            // Ireland-focused profile: try Irish boards first, then general sources
            result = tryDeliverLive(userId, p, irishJobs, "irishjobs_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, jobsIe, "jobsie_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, jobsIreland, "jobsireland_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, indeed, "indeed_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, adzuna, "adzuna_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, companyPages, "company_pages_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, linkedInPublic, "linkedin_public_live", errors);
            if (result != null) return result;
        } else {
            // General profile: try Adzuna first (richer data), then remaining sources
            result = tryDeliverLive(userId, p, adzuna, "adzuna_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, companyPages, "company_pages_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, indeed, "indeed_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, irishJobs, "irishjobs_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, jobsIe, "jobsie_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, jobsIreland, "jobsireland_live", errors);
            if (result != null) return result;

            result = tryDeliverLive(userId, p, linkedInPublic, "linkedin_public_live", errors);
            if (result != null) return result;
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

    private @Nullable JobCardResponse tryDeliverLive(
            UUID userId, UserProfile p, JobSource source, String sourceTag, List<String> errors) {
        if (!source.hasBudget()) {
            errors.add(source.name() + " unavailable (quota/API key).");
            return null;
        }
        List<Job> raw;
        try {
            raw = java.util.concurrent.CompletableFuture.supplyAsync(() -> source.fetch(p))
                .orTimeout(8, java.util.concurrent.TimeUnit.SECONDS)
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
        if (raw.isEmpty()) {
            errors.add(source.name() + " returned no jobs.");
            return null;
        }

        List<Job> deduped = dedup.dedupAndPersist(userId, raw);
        List<JobMatchingService.ScoredJob> ranked = matcher.topN(
            deduped.stream().filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList(),
            p, 5);

        if (ranked.isEmpty()) {
            errors.add(source.name() + " jobs didn't match profile filters.");
            return null;
        }

        ranked = prioritizeByProfileLocation(ranked, p);
        int minPct = p.getMinMatchPercent() == null ? UserProfile.DEFAULT_MIN_MATCH_PERCENT : p.getMinMatchPercent();

        for (JobMatchingService.ScoredJob candidate : ranked) {
            Job j = candidate.job();
            var existing = userJobs.findByUserIdAndJobId(userId, j.getId());
            if (existing.isPresent()) {
                UserJob uj = existing.get();
                Integer mp = uj.getMatchPercent();
                if (mp != null && mp >= minPct) {
                    return JobCardResponse.from(uj, j);
                }
                continue;
            }
            JsonNode json = heuristicEvaluationJson(candidate.score());
            Scored scored = toScored(j, json, sourceTag);
            if (scored.match() < minPct) continue;
            persistSingle(userId, scored);
            dedup.markSeen(userId, List.of(j));
            UserJob saved = userJobs.findByUserIdAndJobId(userId, j.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save live job"));
            log.info("Live match from {} delivered userId={} jobId={} title={}", source.name(), userId, j.getId(), j.getTitle());
            return JobCardResponse.from(saved, j);
        }

        errors.add(source.name() + " could not persist any match.");
        return null;
    }

    // ── Legacy single-source live endpoints (kept for backward compat) ──

    /** @deprecated use {@link #deliverOneLiveMatch} instead */
    @Transactional(timeout = 30)
    public JobCardResponse deliverOneLiveAdzunaMatch(UUID userId) {
        return deliverOneLiveMatch(userId);
    }

    /** @deprecated use {@link #deliverOneLiveMatch} instead */
    @Transactional(timeout = 30)
    public JobCardResponse deliverOneLiveIndeedMatch(UUID userId) {
        return deliverOneLiveMatch(userId);
    }

    /**
     * Profile-matched delivery from IrishJobs.ie only (scrape → pre-rank → AI score → persist).
     */
    public FetchSummary deliverFromIrishJobs(UUID userId, int desiredCount) {
        if (!irishJobs.hasBudget()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IrishJobs source unavailable.");
        }
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first"));
        List<Job> raw = fetchSourceWithTimeout(irishJobs, p);
        if (raw.isEmpty()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IrishJobs returned no listings right now.");
        }
        log.info("User {} IrishJobs raw fetch: {} jobs", userId, raw.size());
        return deliverScored(userId, p, raw, desiredCount, "irishjobs_delivery");
    }

    @SuppressWarnings("unchecked")
    public FetchSummary deliver(UUID userId, int desiredCount) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first"));
        List<Job> raw = scrape.fetchRaw(p);
        return deliverScored(userId, p, raw, desiredCount, "daily_delivery");
    }

    private FetchSummary deliverScored(UUID userId, UserProfile p, List<Job> raw, int desiredCount, String sourceTag) {
        if (Boolean.FALSE.equals(p.getOnboarded()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first");

        int remaining = limits.remaining(userId);
        if (remaining <= 0)
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Daily limit reached. Resets at midnight.");
        int target = Math.min(desiredCount, remaining);

        List<Job> deduped = dedup.dedupAndPersist(userId, raw);
        log.info("User {} dedup pool size: {}", userId, deduped.size());

        List<JobMatchingService.ScoredJob> preRankedCandidates = matcher.topN(
                deduped.stream().filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList(),
                p, preRankPool);
        log.info("User {} pre-ranked pool for NVIDIA NIM: {}", userId, preRankedCandidates.size());

        if (preRankedCandidates.isEmpty()) {
            return new FetchSummary(0, limits.getCount(userId), limits.max(), limits.remaining(userId));
        }

        String cvText       = cvService.activeCvText(userId);
        String systemPrompt = prompts.buildFullSystemPrompt("evaluate");
        int    minPct       = p.getMinMatchPercent() == null ? UserProfile.DEFAULT_MIN_MATCH_PERCENT : p.getMinMatchPercent();

        List<CompletableFuture<Scored>> futures = preRankedCandidates.stream()
            .map(candidate -> {
                Job j = candidate.job();
                return nvidia.generateJsonAsync(systemPrompt, buildPrompt(j, p, cvText), userId, "job-match")
                    .thenApply(json -> toScored(j, json, sourceTag))
                    .exceptionally(ex -> {
                        log.warn("NVIDIA async failed for job {}: {}", j.getId(), ex.getMessage());
                        if (onboardingHeuristicFallback) {
                            JsonNode heuristicJson = heuristicEvaluationJson(candidate.score());
                            return toScored(j, heuristicJson, sourceTag);
                        }
                        return new Scored(j, emptyJson(), 0);
                    });
            })
            .toList();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        List<Scored> scored = futures.stream()
            .map(CompletableFuture::join)
            .filter(s -> s.match() >= minPct)
            .collect(Collectors.toList());

        Set<String> companies = new HashSet<>();
        scored.sort(Comparator.comparingInt(Scored::match).reversed());
        List<Scored> top = scored.stream()
            .filter(s -> companies.add(normalizeCompany(s.job().getCompany())))
            .limit(target)
            .collect(Collectors.toList());

        transactionTemplate.execute(status -> {
            persistResults(userId, top);
            return null;
        });

        return new FetchSummary(top.size(), limits.getCount(userId), limits.max(), limits.remaining(userId));
    }

    private List<Job> fetchSourceWithTimeout(JobSource source, UserProfile profile) {
        try {
            return CompletableFuture.supplyAsync(() -> source.fetch(profile))
                .orTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .exceptionally(ex -> {
                    log.warn("Fetch from {} timed out: {}", source.name(), ex.getMessage());
                    return List.of();
                })
                .join();
        } catch (Exception e) {
            log.warn("Fetch from {} failed: {}", source.name(), e.getMessage());
            return List.of();
        }
    }

    /**
     * Onboarding first-run delivery: no daily-limit gate; reports progress as each job is evaluated and saved.
     */
    public int deliverForOnboarding(
            UUID userId,
            int targetCount,
            int minRequired,
            Consumer<OnboardingDeliveryProgress> onProgress) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first"));
        if (Boolean.FALSE.equals(p.getOnboarded())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first");
        }
        if (cvService.activeCvText(userId).isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload your CV before job matching");
        }

        List<Job> raw = scrape.fetchRaw(p);
        List<Job> deduped = dedup.dedupAndPersist(userId, raw);
        log.info("Onboarding user {} dedup pool size: {}", userId, deduped.size());

        onProgress.accept(new OnboardingDeliveryProgress(
            com.careerops.dto.OnboardingDeliveryDtos.Stage.evaluating_jobs,
            "Evaluating role fit with AI…",
            0, targetCount, minRequired, deduped.size(), null));

        int onboardingPool = Math.min(preRankPool, 12);
        List<JobMatchingService.ScoredJob> ranked = matcher.topN(
                deduped.stream().filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList(),
                p, onboardingPool);
        List<Job> preRanked = ranked.stream().map(JobMatchingService.ScoredJob::job).toList();

        if (preRanked.isEmpty()) {
            onProgress.accept(new OnboardingDeliveryProgress(
                com.careerops.dto.OnboardingDeliveryDtos.Stage.evaluating_jobs,
                "No new roles found in your filters yet",
                0, targetCount, minRequired, deduped.size(), null));
            return 0;
        }

        String cvText = cvService.activeCvText(userId);
        String systemPrompt = prompts.buildFullSystemPrompt("evaluate");
        int minPct = p.getMinMatchPercent() == null ? UserProfile.DEFAULT_MIN_MATCH_PERCENT : p.getMinMatchPercent();

        int evaluated = 0;
        Set<String> companies = new HashSet<>();
        List<Job> persistedJobs = new ArrayList<>();

        // Sequential scoring avoids NVIDIA 429s during first-run onboarding (parallel burst of 25+ calls).
        for (JobMatchingService.ScoredJob rankedJob : ranked) {
            if (evaluated >= targetCount) break;
            Job j = rankedJob.job();
            try {
                JsonNode json;
                try {
                    json = nvidia.generateJson(systemPrompt, buildPrompt(j, p, cvText), userId, "job-match");
                } catch (Exception apiEx) {
                    if (!onboardingHeuristicFallback) throw apiEx;
                    log.warn("Onboarding heuristic fallback for job {} after: {}", j.getId(), apiEx.getMessage());
                    json = heuristicEvaluationJson(rankedJob.score());
                }
                Scored scored = toScored(j, json, "onboarding_delivery");
                json = scored.json();
                int match = scored.match();
                if (match < minPct) continue;
                String companyKey = normalizeCompany(j.getCompany());
                if (!companies.add(companyKey)) continue;

                transactionTemplate.execute(status -> {
                    persistSingle(userId, scored);
                    return null;
                });
                persistedJobs.add(j);
                evaluated++;
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
                log.warn("Onboarding NVIDIA failed for job {}: {}", j.getId(), ex.getMessage());
            }
            try {
                Thread.sleep(400);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        if (!persistedJobs.isEmpty()) {
            dedup.markSeen(userId, persistedJobs);
        }

        return evaluated;
    }

    private void persistSingle(UUID userId, Scored s) {
        if (userJobs.findByUserIdAndJobId(userId, s.job().getId()).isPresent()) return;
        UserJob uj = UserJob.builder()
            .userId(userId).jobId(s.job().getId())
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
    }

    protected void persistResults(UUID userId, List<Scored> top) {
        for (Scored s : top) {
            if (userJobs.findByUserIdAndJobId(userId, s.job().getId()).isPresent()) continue;
            UserJob uj = UserJob.builder()
                .userId(userId).jobId(s.job().getId())
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
        }

        if (!top.isEmpty()) {
            dedup.markSeen(userId, top.stream().map(Scored::job).toList());
            limits.increment(userId, top.size());
        }
    }

    public int cronShare() { return cronShare; }

    private String buildPrompt(Job j, UserProfile p, @Nullable String cv) {
        return String.format("""
            USER:
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
            arr(p.getTargetRoles()), arr(p.getTechStack()), arr(p.getSectors()),
            p.getLocation(), p.getSalaryMin(), p.getSalaryMax(),
            p.getSponsorshipRequired(), p.getMinMatchPercent(),
            trim(cv, 6000),
            j.getTitle(), j.getCompany(), j.getLocation(),
            j.getSalaryMin(), j.getSalaryMax(), j.getSponsorship(),
            trim(j.getDescription(), 4000)
        );
    }

    private Scored toScored(Job j, JsonNode raw, String source) {
        var norm = evaluationValidator.normalizeOrPartial(raw, source);
        JsonNode report = norm.report();
        int match = report.path("matchPercent").asInt(raw.path("matchPercent").asInt(0));
        if (!norm.valid()) {
            log.warn("Evaluation partial for job {}: {}", j.getId(), norm.error());
        }
        return new Scored(j, report, match);
    }

    private JsonNode heuristicEvaluationJson(int preRankScore) {
        int match = Math.min(95, Math.max(0, preRankScore));
        ObjectNode raw = mapper.createObjectNode();
        raw.put("matchPercent", match);
        raw.put("overallScore", match);
        raw.put("verdict", match >= 80 ? "Worth applying" : "Stretch role");
        raw.put("humanSummary", "Heuristic match from profile keywords (AI rate-limited). Re-run for full analysis.");
        raw.putArray("matchedSkills");
        raw.putArray("unmatchedSkills");
        raw.putArray("cvImprovementTips");
        ObjectNode sections = raw.putObject("sections");
        sections.put("executiveSummary", "Pre-ranked match pending full AI evaluation.");
        return evaluationValidator.normalize(raw, "onboarding_heuristic").report();
    }

    private ObjectNode emptyJson() { return mapper.createObjectNode(); }

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
                && !hint.contains("belfast") && !hint.contains("galway")) {
            return ranked;
        }
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
            .replaceAll("[^a-z0-9]", "")
            .trim();
        return clean.isEmpty() ? name.toLowerCase() : clean;
    }

    private record Scored(Job job, JsonNode json, int match) {}
}
