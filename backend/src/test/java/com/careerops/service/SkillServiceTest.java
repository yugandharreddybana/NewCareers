package com.careerops.service;

import com.careerops.dto.SkillRunResponse;
import com.careerops.dto.SkillStartRequest;
import com.careerops.model.SkillRun;
import com.careerops.repository.BatchSkillRunRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SkillConversationRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.skills.SkillHandlerRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;

import java.time.Instant;
import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
    @Mock private EvaluationReportEnrichmentService evaluationEnrichment;
    @Mock private UserJobSkillMatchService skillMatchService;
    @Mock private TailorResumeBuilderService tailorResumeBuilder;
    @Mock private SkillMdExecutorService skillMdExecutor;
    @Mock private UserConsentService consentService;

    private final ObjectMapper mapper = new ObjectMapper();
    private SkillService skillService;

    @BeforeEach
    void setUp() {
        PlatformTransactionManager txManager = new AbstractPlatformTransactionManager() {
            @Override
            protected Object doGetTransaction() {
                return new Object();
            }

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
                tokenUsageService, new SimpleMeterRegistry(), catalogSkills,
                evaluationValidator, cvHumanScoreService, cvService, tailorResumePending,
                localFallback, profiles, evaluationEnrichment, skillMatchService,
                tailorResumeBuilder, skillMdExecutor, consentService, txManager);
    }

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

        ReflectionTestUtils.setField(skillService, "dailyTokenBudget", 500_000L);
        doNothing().when(consentService).validateAiConsent(userId);
        doNothing().when(conversations).deleteByUserIdAndSkillAndUserJobIdAndStatus(
                eq(userId), eq(skill), eq(userJobId), eq("pending_answer"));
        when(tokenUsageService.hasExceededBudget(userId, 500_000L)).thenReturn(false);
        when(catalogSkills.handles(skill)).thenReturn(false);
        when(registry.handles(skill)).thenReturn(false);
        when(validator.validateForSkill(userId, skill)).thenReturn(Collections.emptyList());
        when(skillMdExecutor.isAvailable()).thenReturn(false);
        when(localFallback.tryFallback(eq(skill), eq(userId), eq(userJobId), any()))
                .thenReturn(Optional.empty());

        skillService.startSkill(
                new SkillStartRequest(skill, userJobId, null, null, null, null, null, true),
                userId);

        verify(skillRuns).deleteByUserIdAndUserJobIdAndSkill(userId, userJobId, skill);
        verify(skillRuns, never()).findValidCachedRun(any(), any(), any(), any());
    }
}
