package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.JobDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.*;
import com.careerops.repository.*;
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
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Wires scrape -> dedup -> JobMatchingService pre-rank -> parallel Gemini score -> top-N -> persist.
 */
@Service
@SuppressWarnings("all")
public class JobDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(JobDeliveryService.class);

    private final JobScrapeService      scrape;
    private final DeduplicationService  dedup;
    private final GeminiService         gemini;
    private final SkillPromptLibrary    prompts;
    private final UserProfileRepository profiles;
    private final UserJobRepository     userJobs;
    private final CvService             cvService;
    private final DailyLimitService     limits;
    private final JobMatchingService    matcher;
    private final ObjectMapper          mapper; // 3.048 - Injected
    private final TransactionTemplate   transactionTemplate; // 3.047

    @Value("${jobs.cron.daily.count:3}")
    private int cronShare;

    @Value("${jobs.gemini.prerank.pool:25}")
    private int preRankPool;

    public JobDeliveryService(JobScrapeService scrape, DeduplicationService dedup,
                              GeminiService gemini, SkillPromptLibrary prompts,
                              UserProfileRepository profiles, UserJobRepository userJobs,
                              CvService cv, DailyLimitService limits,
                              JobMatchingService matcher, ObjectMapper mapper,
                              PlatformTransactionManager transactionManager) {
        this.scrape   = scrape;    this.dedup    = dedup;    this.gemini   = gemini;
        this.prompts  = prompts;   this.profiles = profiles; this.userJobs = userJobs;
        this.cvService = cv;       this.limits   = limits;   this.matcher  = matcher;
        this.mapper   = mapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    // 3.047 — Removed @Transactional(timeout = 10) from long-running async method
    @SuppressWarnings("unchecked")
    public FetchSummary deliver(UUID userId, int desiredCount) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first"));
        if (Boolean.FALSE.equals(p.getOnboarded()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Complete onboarding first");

        int remaining = limits.remaining(userId);
        if (remaining <= 0)
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Daily limit reached. Resets at midnight.");
        int target = Math.min(desiredCount, remaining);

        List<Job> raw     = scrape.fetchRaw(p);
        List<Job> deduped = dedup.dedupAndPersist(userId, raw);
        log.info("User {} dedup pool size: {}", userId, deduped.size());

        List<Job> preRanked = matcher.topN(
                deduped.stream().filter(j -> j.getCompany() != null && !j.getCompany().isBlank()).toList(),
                p, preRankPool)
            .stream().map(JobMatchingService.ScoredJob::job).toList();
        log.info("User {} pre-ranked pool for Gemini: {}", userId, preRanked.size());

        if (preRanked.isEmpty()) {
            return new FetchSummary(0, limits.getCount(userId), limits.max(), limits.remaining(userId));
        }

        String cvText       = cvService.activeCvText(userId);
        String systemPrompt = prompts.buildFullSystemPrompt("evaluate");
        int    minPct       = p.getMinMatchPercent() == null ? UserProfile.DEFAULT_MIN_MATCH_PERCENT : p.getMinMatchPercent();

        List<CompletableFuture<Scored>> futures = preRanked.stream()
            .map(j -> gemini.generateJsonAsync(systemPrompt, buildPrompt(j, p, cvText), userId, "job-match")
                .thenApply(json -> new Scored(j, json, json.path("matchPercent").asInt(0)))
                .exceptionally(ex -> {
                    log.warn("Gemini async failed for job {}: {}", j.getId(), ex.getMessage());
                    return new Scored(j, emptyJson(), 0);
                }))
            .toList();

        // 3.047 — Async wait happens OUTSIDE transactional boundary
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

    /**
     * Performs DB writes (3.047).
     */
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
