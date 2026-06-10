package com.careerops.service;

import com.careerops.dto.SkillRunResponse;
import com.careerops.dto.SkillStartRequest;
import com.careerops.model.PlanTier;
import com.careerops.model.PlanTierLimits;
import com.careerops.model.SkillRun;
import com.careerops.model.UserProfile;
import com.careerops.repository.BatchSkillRunRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SkillConversationRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.skills.SkillHandlerRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SkillServiceTest {

    @Mock private NvidiaAgentService nvidia;
    @Mock private SkillPromptLibrary prompts;
    @Mock private ProfileValidator validator;
    @Mock private SkillRunRepository skillRuns;
    @Mock private BatchSkillRunRepository batchRuns;
    @Mock private UserJobRepository userJobs;
    @Mock private JobRepository jobs;
    @Mock private SkillConversationRepository conversations;
    @Mock private SkillHandlerRegistry registry;
    @Mock private ResendEmailService emailService;
    @Mock private NotificationService notificationService;
    @Mock private TokenUsageService tokenUsageService;
    @Mock private CatalogSkillService catalogSkills;
    @Mock private EvaluationReportValidator evaluationValidator;
    @Mock private CvHumanScoreService cvHumanScoreService;
    @Mock private CvService cvService;
    @Mock private TailorResumePendingStore tailorResumePending;
    @Mock private SkillLocalFallbackService localFallback;
    @Mock private UserProfileRepository profiles;
    @Mock private UserPlanTierService planTierService;
    @Mock private UserQuotaGrantService quotaGrantService;
    @Mock private EvaluationReportEnrichmentService evaluationEnrichment;
    @Mock private UserJobSkillMatchService skillMatchService;
    @Mock private TailorResumeBuilderService tailorResumeBuilder;
    @Mock private SkillMdExecutorService skillMdExecutor;
    @Mock private UserConsentService consentService;
    @Mock private AiProviderRouter aiProviderRouter;                  // Prompt 4
    @Mock private SkillExecutionContextBuilder contextBuilder;        // Prompt 4
    @Mock private CoverLetterNormalizer coverLetterNormalizer;

    private final ObjectMapper mapper = new ObjectMapper();
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private SkillService skillService;

    @BeforeEach
    void setUp() {
        PlatformTransactionManager txManager = new AbstractPlatformTransactionManager() {
            @Override
            protected Object doGetTransaction() { return new Object(); }
            @Override
            protected void doBegin(Object transaction, TransactionDefinition definition) {}
            @Override
            protected void doCommit(DefaultTransactionStatus status) {}
            @Override
            protected void doRollback(DefaultTransactionStatus status) {}
        };

        skillService = new SkillService(
                nvidia, prompts, validator, skillRuns, batchRuns, userJobs, jobs,
                conversations, registry, mapper, emailService, notificationService,
                tokenUsageService, meterRegistry, catalogSkills,
                evaluationValidator, cvHumanScoreService, cvService, tailorResumePending,
                localFallback, profiles, planTierService, quotaGrantService, evaluationEnrichment, skillMatchService,
                tailorResumeBuilder, skillMdExecutor, consentService, txManager,
                aiProviderRouter, contextBuilder, coverLetterNormalizer);  // Prompt 4

        lenient().when(quotaGrantService.tokenBudget(any(), any()))
                .thenAnswer(inv -> PlanTierLimits.tokenBudget(inv.getArgument(1)));
    }

    // ================================================================
    // EXISTING TESTS
    // ================================================================

    @Test
    @DisplayName("getLastRun — returns valid result from repository")
    void getLastRun_returnsStoredResult() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "evaluate";

        SkillRun run = new SkillRun();
        run.setSkill(skill);
        run.setOutput(mapper.createObjectNode().put("test", "data"));

        when(skillRuns.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, skill))
                .thenReturn(Optional.of(run));

        SkillRunResponse result = skillService.getLastRun(userId, userJobId, skill);

        assertThat(result).isNotNull();
        assertThat(result.type()).isEqualTo(SkillRunResponse.Type.RESULT);
        assertThat(result.data().path("test").asText()).isEqualTo("data");
    }

    @Test
    @DisplayName("findLastRun — empty when no prior run")
    void findLastRun_emptyWhenMissing() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();

        when(skillRuns.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, "tailor-resume"))
                .thenReturn(Optional.empty());

        assertThat(skillService.findLastRun(userId, userJobId, "tailor-resume")).isEmpty();
    }

    @Test
    @DisplayName("startSkill — returns cached evaluate without calling executor")
    void startSkill_returnsCachedEvaluate_withoutCallingExecutor() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "evaluate";

        SkillRun cached = new SkillRun();
        cached.setSkill(skill);
        cached.setOutput(mapper.createObjectNode().put("score", "A"));
        cached.setExpiresAt(Instant.now().plusSeconds(3600));

        doNothing().when(consentService).validateAiConsent(userId);
        doNothing().when(conversations).deleteByUserIdAndSkillAndUserJobIdAndStatus(
                eq(userId), eq(skill), eq(userJobId), eq("pending_answer"));
        when(skillRuns.findValidCachedRun(eq(userId), eq(userJobId), eq(skill), any(Instant.class)))
                .thenReturn(Optional.of(cached));

        SkillRunResponse response = skillService.startSkill(
                new SkillStartRequest(skill, userJobId, null, null, null, null, null, null),
                userId);

        assertThat(response.type()).isEqualTo(SkillRunResponse.Type.RESULT);
        assertThat(response.data().path("score").asText()).isEqualTo("A");
        verify(skillMdExecutor, never()).execute(any(), any(), any(), any());
        verify(validator, never()).validateForSkill(any(), any());
    }

    @Test
    @DisplayName("startSkill — forceRefresh bypasses cache lookup")
    void startSkill_forceRefresh_skipsCache() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "evaluate";

        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.FREE);
        doNothing().when(consentService).validateAiConsent(userId);
        doNothing().when(conversations).deleteByUserIdAndSkillAndUserJobIdAndStatus(
                eq(userId), eq(skill), eq(userJobId), eq("pending_answer"));
        when(tokenUsageService.hasExceededBudget(userId, 50_000L)).thenReturn(false);
        when(catalogSkills.handles(skill)).thenReturn(false);
        when(registry.handles(skill)).thenReturn(false);
        when(validator.validateForSkill(userId, skill)).thenReturn(Collections.emptyList());
        when(skillMdExecutor.isAvailable()).thenReturn(false);
        // Router tried first (NVIDIA unavailable) — throws so falls to localFallback
        when(prompts.buildBackendSkillSystemPrompt(eq(skill), eq(userId))).thenReturn("sys");
        when(contextBuilder.buildUserMessage(eq(skill), eq(userId), eq(userJobId), any())).thenReturn("usr");
        when(aiProviderRouter.routePrompt(any(), eq(userId), contains("skill-")))
                .thenThrow(new RuntimeException("router fail"));
        when(localFallback.tryFallback(eq(skill), eq(userId), eq(userJobId), any()))
                .thenReturn(Optional.empty());

        skillService.startSkill(
                new SkillStartRequest(skill, userJobId, null, null, null, null, null, true),
                userId);

        verify(skillRuns).deleteByUserIdAndUserJobIdAndSkill(userId, userJobId, skill);
        verify(skillRuns, never()).findValidCachedRun(any(), any(), any(), any());
    }

    // ================================================================
    // NEW TESTS — Prompt 4 Part A: AiProviderRouter wiring
    // ================================================================

    @Test
    @DisplayName("routeSkill — NVIDIA unavailable, router succeeds: localFallback NOT called")
    void routeSkill_when_nvidia_unavailable_router_succeeds() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "research";

        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.FREE);
        doNothing().when(consentService).validateAiConsent(userId);
        doNothing().when(conversations).deleteByUserIdAndSkillAndUserJobIdAndStatus(
                eq(userId), eq(skill), eq(userJobId), eq("pending_answer"));
        when(skillRuns.findValidCachedRun(eq(userId), eq(userJobId), eq(skill), any(Instant.class)))
                .thenReturn(Optional.empty());
        when(tokenUsageService.hasExceededBudget(userId, 50_000L)).thenReturn(false);
        when(catalogSkills.handles(skill)).thenReturn(false);
        when(registry.handles(skill)).thenReturn(false);
        when(validator.validateForSkill(userId, skill)).thenReturn(Collections.emptyList());
        when(skillMdExecutor.isAvailable()).thenReturn(false);
        when(prompts.buildBackendSkillSystemPrompt(eq(skill), eq(userId))).thenReturn("sys");
        when(contextBuilder.buildUserMessage(eq(skill), eq(userId), eq(userJobId), any())).thenReturn("usr");
        when(aiProviderRouter.routePrompt(any(), eq(userId), contains("skill-")))
                .thenReturn("{\"summary\":\"Company insight\",\"mode\":\"skill_md\"}");

        SkillRun saved = new SkillRun();
        saved.setSkill(skill);
        saved.setOutput(mapper.createObjectNode().put("summary", "Company insight"));
        when(skillRuns.save(any(SkillRun.class))).thenReturn(saved);

        SkillRunResponse response = skillService.startSkill(
                new SkillStartRequest(skill, userJobId, null, null, null, null, null, null),
                userId);

        assertThat(response.type()).isEqualTo(SkillRunResponse.Type.RESULT);
        verify(localFallback, never()).tryFallback(any(), any(), any(), any());
        verify(aiProviderRouter, times(1)).routePrompt(any(), eq(userId), contains("skill-"));
    }

    @Test
    @DisplayName("routeSkill — router throws: localFallback.tryFallback is invoked")
    void routeSkill_falls_back_to_localFallback_on_router_failure() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "prep-interview";

        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.FREE);
        doNothing().when(consentService).validateAiConsent(userId);
        doNothing().when(conversations).deleteByUserIdAndSkillAndUserJobIdAndStatus(
                eq(userId), eq(skill), eq(userJobId), eq("pending_answer"));
        when(skillRuns.findValidCachedRun(eq(userId), eq(userJobId), eq(skill), any(Instant.class)))
                .thenReturn(Optional.empty());
        when(tokenUsageService.hasExceededBudget(userId, 50_000L)).thenReturn(false);
        when(catalogSkills.handles(skill)).thenReturn(false);
        when(registry.handles(skill)).thenReturn(false);
        when(validator.validateForSkill(userId, skill)).thenReturn(Collections.emptyList());
        when(skillMdExecutor.isAvailable()).thenReturn(false);
        when(prompts.buildBackendSkillSystemPrompt(eq(skill), eq(userId))).thenReturn("sys");
        when(contextBuilder.buildUserMessage(eq(skill), eq(userId), eq(userJobId), any())).thenReturn("usr");
        when(aiProviderRouter.routePrompt(any(), eq(userId), contains("skill-")))
                .thenThrow(new RuntimeException("Gemini 503"));
        when(localFallback.tryFallback(eq(skill), eq(userId), eq(userJobId), any()))
                .thenReturn(Optional.empty());

        SkillRunResponse response = skillService.startSkill(
                new SkillStartRequest(skill, userJobId, null, null, null, null, null, null),
                userId);

        verify(localFallback, times(1)).tryFallback(eq(skill), eq(userId), eq(userJobId), any());
        assertThat(response.type()).isEqualTo(SkillRunResponse.Type.ERROR);
    }

    // ================================================================
    // NEW TESTS — Prompt 4 Part B: dedup guard
    // ================================================================

    @Test
    @DisplayName("dedup — second concurrent call waits on first; executor called exactly once")
    void dedup_hit_concurrent_calls_execute_once() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "research";

        when(planTierService.resolveForUser(any())).thenReturn(PlanTier.FREE);

        CountDownLatch firstStarted  = new CountDownLatch(1);
        CountDownLatch releaseFirst  = new CountDownLatch(1);
        AtomicInteger routerCallCount = new AtomicInteger(0);

        doNothing().when(consentService).validateAiConsent(any());
        doNothing().when(conversations).deleteByUserIdAndSkillAndUserJobIdAndStatus(
                any(), any(), any(), any());
        when(skillRuns.findValidCachedRun(any(), any(), any(), any())).thenReturn(Optional.empty());
        when(tokenUsageService.hasExceededBudget(any(), any(Long.class))).thenReturn(false);
        when(catalogSkills.handles(skill)).thenReturn(false);
        when(registry.handles(skill)).thenReturn(false);
        when(validator.validateForSkill(any(), any())).thenReturn(Collections.emptyList());
        when(skillMdExecutor.isAvailable()).thenReturn(false);
        when(prompts.buildBackendSkillSystemPrompt(any(), any())).thenReturn("sys");
        when(contextBuilder.buildUserMessage(any(), any(), any(), any())).thenReturn("usr");

        when(aiProviderRouter.routePrompt(any(), any(), any())).thenAnswer(invocation -> {
            int call = routerCallCount.incrementAndGet();
            if (call == 1) {
                firstStarted.countDown();
                releaseFirst.await(5, TimeUnit.SECONDS);
            }
            return "{\"summary\":\"result\",\"mode\":\"skill_md\"}";
        });

        SkillRun saved = new SkillRun();
        saved.setSkill(skill);
        saved.setOutput(mapper.createObjectNode().put("summary", "result"));
        when(skillRuns.save(any(SkillRun.class))).thenReturn(saved);

        SkillStartRequest req = new SkillStartRequest(skill, userJobId, null, null, null, null, null, null);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CompletableFuture<SkillRunResponse> first  = CompletableFuture.supplyAsync(
                () -> skillService.startSkill(req, userId), pool);

        firstStarted.await(5, TimeUnit.SECONDS);
        CompletableFuture<SkillRunResponse> second = CompletableFuture.supplyAsync(
                () -> skillService.startSkill(req, userId), pool);

        releaseFirst.countDown();

        SkillRunResponse r1 = first.get(10, TimeUnit.SECONDS);
        SkillRunResponse r2 = second.get(10, TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(routerCallCount.get()).isEqualTo(1);
        assertThat(r1.type()).isEqualTo(SkillRunResponse.Type.RESULT);
        assertThat(r2.type()).isEqualTo(SkillRunResponse.Type.RESULT);

        double dedupCount = meterRegistry.counter("skill.dedup.hit", "skill", skill).count();
        assertThat(dedupCount).isEqualTo(1.0);
    }

    // ================================================================
    // NEW TESTS — Prompt 6: tier-aware token budget
    // ================================================================

    @Test
    @DisplayName("executeSkillInternal — FREE tier uses 50k token budget")
    void budgetCheck_usesFreeTierBudget() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "research";

        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.FREE);
        doNothing().when(consentService).validateAiConsent(userId);
        doNothing().when(conversations).deleteByUserIdAndSkillAndUserJobIdAndStatus(
                eq(userId), eq(skill), eq(userJobId), eq("pending_answer"));
        when(skillRuns.findValidCachedRun(any(), any(), any(), any())).thenReturn(Optional.empty());
        when(tokenUsageService.hasExceededBudget(userId, 50_000L)).thenReturn(true);
        when(catalogSkills.handles(skill)).thenReturn(false);

        SkillRunResponse response = skillService.startSkill(
                new SkillStartRequest(skill, userJobId, null, null, null, null, null, null),
                userId);

        verify(tokenUsageService).hasExceededBudget(userId, 50_000L);
        assertThat(response.type()).isEqualTo(SkillRunResponse.Type.ERROR);
    }

    @Test
    @DisplayName("executeSkillInternal — catalog skills bypass AI token budget")
    void catalogSkill_bypassesAiBudget() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "help";

        doNothing().when(conversations).deleteByUserIdAndSkillAndUserJobIdAndStatus(
                eq(userId), eq(skill), eq(userJobId), eq("pending_answer"));
        when(catalogSkills.handles(skill)).thenReturn(true);
        when(catalogSkills.execute(eq(skill), eq(userId), any())).thenReturn(
                SkillRunResponse.result(skill, mapper.createObjectNode()));

        SkillRunResponse response = skillService.startSkill(
                new SkillStartRequest(skill, userJobId, null, null, null, null, null, null),
                userId);

        verify(tokenUsageService, never()).hasExceededBudget(any(), any(Long.class));
        assertThat(response.type()).isEqualTo(SkillRunResponse.Type.RESULT);
    }
}
