package com.careerops.service;

import com.careerops.dto.OnboardingDeliveryDtos;
import com.careerops.util.DeliveryErrorSanitizer;
import com.careerops.dto.OnboardingDeliveryDtos.DeliveryStatusResponse;
import com.careerops.dto.OnboardingDeliveryDtos.StartDeliveryResponse;
import com.careerops.dto.OnboardingDeliveryDtos.Stage;
import com.careerops.exception.ApiException;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.cache.CacheManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * First-run onboarding pipeline: normalize CV → scrape → AI-evaluate until ≥3 jobs ready.
 */
@Service
@Slf4j
public class OnboardingDeliveryService {

    private final UserProfileRepository profiles;
    private final UserJobRepository userJobs;
    private final CvService cvService;
    private final CvNormalizationService cvNormalization;
    private final JobDeliveryService jobDelivery;
    private final ObjectMapper mapper;
    private final TransactionTemplate progressTx;
    private final CacheManager cacheManager;
    private final UserConsentService consentService;

    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final ConcurrentHashMap<UUID, Boolean> running = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, Object> progressLocks = new ConcurrentHashMap<>();
    /** Live progress for polling (DB JSON column may lag on H2 dev). */
    private final ConcurrentHashMap<UUID, OnboardingDeliveryProgress> liveProgress = new ConcurrentHashMap<>();

    public OnboardingDeliveryService(
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            CvService cvService,
            CvNormalizationService cvNormalization,
            JobDeliveryService jobDelivery,
            ObjectMapper mapper,
            PlatformTransactionManager transactionManager,
            CacheManager cacheManager,
            UserConsentService consentService) {
        this.profiles = profiles;
        this.userJobs = userJobs;
        this.cvService = cvService;
        this.cvNormalization = cvNormalization;
        this.jobDelivery = jobDelivery;
        this.mapper = mapper;
        this.progressTx = new TransactionTemplate(transactionManager);
        this.progressTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.cacheManager = cacheManager;
        this.consentService = consentService;
    }

    private void evictProfileCache(UUID userId) {
        var cache = cacheManager.getCache("user-profile");
        if (cache != null) {
            cache.evict(userId);
        }
    }

    public StartDeliveryResponse start(UUID userId, boolean restart) {
        consentService.validateAiConsent(userId);
        UserProfile profile = profiles.findByUserId(userId)
            .orElseThrow(() -> ApiException.badRequest("Complete your profile first"));
        if (!Boolean.TRUE.equals(profile.getOnboarded())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mark onboarding complete before starting delivery");
        }
        if (!cvService.hasActiveCv(userId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload your CV before continuing");
        }

        OnboardingDeliveryProgress existing = loadProgressFromDb(userId);
        if (running.putIfAbsent(userId, Boolean.TRUE) != null) {
            return new StartDeliveryResponse(existing.stage().name(), existing.message());
        }

        if (!restart && (existing.readyPartial() || existing.ready())) {
            running.remove(userId);
            return new StartDeliveryResponse(existing.stage().name(), existing.message());
        }

        OnboardingDeliveryProgress kickoff = new OnboardingDeliveryProgress(
            Stage.reading_cv,
            "Reading your CV…",
            0,
            OnboardingDeliveryDtos.DEFAULT_TARGET_COUNT,
            OnboardingDeliveryDtos.DEFAULT_MIN_EVALUATED,
            0,
            null
        );
        saveProgress(userId, kickoff);

        executor.execute(() -> runPipeline(userId));
        return new StartDeliveryResponse(kickoff.stage().name(), kickoff.message());
    }

    @Transactional(readOnly = true)
    public DeliveryStatusResponse status(UUID userId) {
        OnboardingDeliveryProgress p = loadProgressFromDb(userId);

        int dbEvaluated = (int) userJobs.countByUserIdAndScoreBreakdownIsNotNull(userId);
        int evaluated = Math.max(p.evaluatedCount(), dbEvaluated);

        Stage stage = p.stage();
        if (evaluated >= p.minRequired()
            && (stage == Stage.evaluating_jobs || stage == Stage.fetching_jobs || stage == Stage.ready_partial)) {
            stage = evaluated >= p.targetCount() ? Stage.ready : Stage.ready_partial;
        }

        return new DeliveryStatusResponse(
            stage.name(),
            p.message(),
            evaluated,
            p.targetCount(),
            p.minRequired(),
            p.jobsDiscovered(),
            evaluated >= p.minRequired(),
            stage == Stage.ready || evaluated >= p.targetCount(),
            DeliveryErrorSanitizer.forClient(p.error())
        );
    }

    private void runPipeline(UUID userId) {
        try {
            saveProgress(userId, progress(Stage.reading_cv, "Reading your CV…", 0, 0));
            saveProgress(userId, progress(Stage.normalizing_cv, "Preparing your profile for AI matching…", 0, 0));
            cvNormalization.normalizeAndStore(userId);

            saveProgress(userId, progress(Stage.fetching_jobs, "Searching job boards in your area…", 0, 0));
            jobDelivery.deliverForOnboarding(
                userId,
                OnboardingDeliveryDtos.DEFAULT_TARGET_COUNT,
                OnboardingDeliveryDtos.DEFAULT_MIN_EVALUATED,
                snapshot -> saveProgress(userId, snapshot)
            );

            OnboardingDeliveryProgress finalP = loadProgressFromDb(userId);
            if (finalP.stage() != Stage.failed) {
                int evaluated = (int) userJobs.countByUserIdAndScoreBreakdownIsNotNull(userId);
                Stage done = evaluated >= OnboardingDeliveryDtos.DEFAULT_MIN_EVALUATED
                    ? (evaluated >= OnboardingDeliveryDtos.DEFAULT_TARGET_COUNT ? Stage.ready : Stage.ready_partial)
                    : Stage.failed;
                String msg = done == Stage.failed
                    ? "We could not find enough matching roles yet. You can fetch more from the dashboard."
                    : (done == Stage.ready ? "Your job matches are ready" : "Your top matches are ready");
                saveProgress(userId, new OnboardingDeliveryProgress(
                    done, msg, evaluated,
                    OnboardingDeliveryDtos.DEFAULT_TARGET_COUNT,
                    OnboardingDeliveryDtos.DEFAULT_MIN_EVALUATED,
                    finalP.jobsDiscovered(),
                    done == Stage.failed ? msg : null
                ));
            }
        } catch (Exception e) {
            log.warn("Onboarding delivery failed for userId={}: {}", userId, e.getMessage(), e);
            saveProgress(userId, new OnboardingDeliveryProgress(
                Stage.failed,
                "Job matching hit a snag — try again from the dashboard.",
                (int) userJobs.countByUserIdAndScoreBreakdownIsNotNull(userId),
                OnboardingDeliveryDtos.DEFAULT_TARGET_COUNT,
                OnboardingDeliveryDtos.DEFAULT_MIN_EVALUATED,
                0,
                DeliveryErrorSanitizer.forClient(e)
            ));
        } finally {
            running.remove(userId);
            progressLocks.remove(userId);
            // Retain liveProgress until terminal stage (ready / ready_partial / failed) for polling clients
        }
    }

    private static OnboardingDeliveryProgress progress(Stage stage, String message, int evaluated, int discovered) {
        return new OnboardingDeliveryProgress(
            stage, message, evaluated,
            OnboardingDeliveryDtos.DEFAULT_TARGET_COUNT,
            OnboardingDeliveryDtos.DEFAULT_MIN_EVALUATED,
            discovered,
            null
        );
    }

    private static OnboardingDeliveryProgress idleProgress() {
        return new OnboardingDeliveryProgress(
            Stage.idle, "Not started", 0,
            OnboardingDeliveryDtos.DEFAULT_TARGET_COUNT,
            OnboardingDeliveryDtos.DEFAULT_MIN_EVALUATED,
            0, null
        );
    }

    void saveProgress(UUID userId, OnboardingDeliveryProgress p) {
        Object lock = progressLocks.computeIfAbsent(userId, id -> new Object());
        synchronized (lock) {
            ObjectNode node = mapper.createObjectNode();
            node.put("stage", p.stage().name());
            node.put("message", p.message());
            node.put("evaluatedCount", p.evaluatedCount());
            node.put("targetCount", p.targetCount());
            node.put("minRequired", p.minRequired());
            node.put("jobsDiscovered", p.jobsDiscovered());
            if (p.error() != null) {
                node.put("error", p.error());
            }
            liveProgress.put(userId, p);
            String json = node.toString();
            progressTx.executeWithoutResult(status -> {
                int updated = profiles.patchOnboardingDelivery(userId, json);
                if (updated == 0) {
                    throw ApiException.badRequest("Profile not found");
                }
            });
            evictProfileCache(userId);
        }
    }

    private OnboardingDeliveryProgress loadProgressFromDb(UUID userId) {
        OnboardingDeliveryProgress live = liveProgress.get(userId);
        if (live != null && (running.containsKey(userId) || isTerminal(live.stage()))) {
            return live;
        }
        String json = profiles.findOnboardingDeliveryJson(userId);
        if (json == null || json.isBlank()) {
            return idleProgress();
        }
        try {
            return readProgress(mapper.readTree(json));
        } catch (Exception e) {
            log.warn("Could not parse onboarding_delivery for userId={}: {}", userId, e.getMessage());
            return idleProgress();
        }
    }

    private static boolean isTerminal(Stage stage) {
        return stage == Stage.ready || stage == Stage.ready_partial || stage == Stage.failed;
    }

    private OnboardingDeliveryProgress readProgress(JsonNode node) {
        if (node == null || node.isNull()) {
            return idleProgress();
        }
        Stage stage;
        try {
            stage = Stage.valueOf(node.path("stage").asText("idle"));
        } catch (IllegalArgumentException e) {
            stage = Stage.idle;
        }
        return new OnboardingDeliveryProgress(
            stage,
            node.path("message").asText(""),
            node.path("evaluatedCount").asInt(0),
            node.path("targetCount").asInt(OnboardingDeliveryDtos.DEFAULT_TARGET_COUNT),
            node.path("minRequired").asInt(OnboardingDeliveryDtos.DEFAULT_MIN_EVALUATED),
            node.path("jobsDiscovered").asInt(0),
            node.path("error").asText(null)
        );
    }
}
