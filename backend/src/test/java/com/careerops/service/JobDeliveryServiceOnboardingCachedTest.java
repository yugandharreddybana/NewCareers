package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.sources.*;
import com.careerops.service.sources.company.CompanyCareerSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JobDeliveryServiceOnboardingCachedTest {

    @Mock JobScrapeService scrape;
    @Mock DeduplicationService dedup;
    @Mock NvidiaService nvidia;
    @Mock SkillPromptLibrary prompts;
    @Mock UserProfileRepository profiles;
    @Mock UserJobRepository userJobs;
    @Mock JobRepository jobs;
    @Mock CvService cvService;
    @Mock DailyLimitService limits;
    @Mock JobMatchingService matcher;
    @Mock EvaluationReportValidator evaluationValidator;
    @Mock StructuredJobEvaluationBuilder evaluationBuilder;
    @Mock EvaluationReportEnrichmentService evaluationEnrichment;
    @Mock ParallelJobEvaluationService parallelEval;
    @Mock AdzunaSource adzuna;
    @Mock IndeedRssSource indeed;
    @Mock IrishJobsSource irishJobs;
    @Mock JobsIeSource jobsIe;
    @Mock JobsIrelandSource jobsIreland;
    @Mock CompanyCareerSource companyPages;
    @Mock LinkedInPublicSource linkedInPublic;
    @Mock JobFetchSettings fetchSettings;
    @Mock CachedJobPoolService cachedJobPool;
    @Mock ProfileReadableFields profileFields;

    private JobDeliveryService delivery;
    private final UUID userId = UUID.randomUUID();
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        PlatformTransactionManager txManager = new AbstractPlatformTransactionManager() {
            @Override protected Object doGetTransaction() { return new Object(); }
            @Override protected void doBegin(Object t, TransactionDefinition d) {}
            @Override protected void doCommit(DefaultTransactionStatus s) {}
            @Override protected void doRollback(DefaultTransactionStatus s) {}
        };

        lenient().when(fetchSettings.maxAgeDays()).thenReturn(14);

        delivery = new JobDeliveryService(
            scrape, dedup, nvidia, prompts, profiles, userJobs, jobs, cvService, limits, matcher,
            mapper, txManager, evaluationValidator, evaluationBuilder, evaluationEnrichment,
            parallelEval, profileFields, adzuna, indeed, irishJobs, jobsIe, jobsIreland, companyPages,
            linkedInPublic, fetchSettings, cachedJobPool);

        ReflectionTestUtils.setField(delivery, "useCachedPool", true);
        ReflectionTestUtils.setField(delivery, "cachedPoolFetchCap", 500);
        ReflectionTestUtils.setField(delivery, "preRankPool", 25);
        ReflectionTestUtils.setField(delivery, "persistDiscoveryPool", false);
        ReflectionTestUtils.setField(delivery, "onboardingHeuristicFallback", false);
    }

    @Test
    void deliverForOnboarding_firstUser_usesCachedPool_notScrape() {
        UserProfile profile = onboardedProfile();
        Job job = sampleJob("Full Stack Developer", "Acme");

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(cvService.activeCvText(userId)).thenReturn("Java developer CV");
        when(userJobs.countByUserIdAndDeletedAtIsNull(userId)).thenReturn(0L);
        when(cachedJobPool.loadCandidates(profile, 500)).thenReturn(List.of(job));
        when(dedup.dedupForPipelineDelivery(userId, List.of(job))).thenReturn(List.of());
        when(matcher.topN(any(), eq(profile), anyInt())).thenReturn(List.of());

        delivery.deliverForOnboarding(userId, 10, 3, p -> {});

        verify(cachedJobPool).loadCandidates(profile, 500);
        verify(scrape, never()).fetchRaw(any());
    }

    @Test
    void deliverForOnboarding_firstUser_returnsScoredJobs() {
        UserProfile profile = onboardedProfile();
        Job job = sampleJob("Full Stack Developer", "Acme");
        job.setLocation("Dublin, Ireland");
        job.setFingerprint("fp-" + job.getId());

        ObjectNode aiJson = mapper.createObjectNode();
        aiJson.put("matchPercent", 85);
        aiJson.put("overallScore", 85);

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(cvService.activeCvText(userId)).thenReturn("Java developer CV");
        when(userJobs.countByUserIdAndDeletedAtIsNull(userId)).thenReturn(0L);
        when(cachedJobPool.loadCandidates(profile, 500)).thenReturn(List.of(job));
        when(dedup.dedupForPipelineDelivery(userId, List.of(job))).thenReturn(List.of(job));
        when(matcher.topN(any(), eq(profile), anyInt()))
            .thenReturn(List.of(new JobMatchingService.ScoredJob(job, 80, List.of("Java"), List.of("role match"))));
        when(prompts.buildFullSystemPrompt("evaluate")).thenReturn("system");
        when(nvidia.generateJson(anyString(), anyString(), eq(userId), eq("job-match"))).thenReturn(aiJson);
        when(evaluationValidator.normalizeOrPartial(eq(aiJson), anyString()))
            .thenReturn(new EvaluationReportValidator.NormalizationResult(aiJson, true, null));
        when(evaluationEnrichment.isCompleteReport(aiJson)).thenReturn(true);
        when(evaluationEnrichment.ensureComplete(eq(userId), eq(job), eq(profile), anyString(), eq(aiJson), anyString()))
            .thenReturn(aiJson);
        when(userJobs.findByUserIdAndJobId(userId, job.getId())).thenReturn(Optional.empty());
        when(userJobs.findRowIdByUserIdAndJobIdIncludingDeleted(userId, job.getId())).thenReturn(Optional.empty());

        ArgumentCaptor<UserJob> saved = ArgumentCaptor.forClass(UserJob.class);
        when(userJobs.save(saved.capture())).thenAnswer(inv -> inv.getArgument(0));

        int evaluated = delivery.deliverForOnboarding(userId, 10, 3, p -> {});

        assertThat(evaluated).isEqualTo(1);
        assertThat(saved.getValue().getScoreBreakdown()).isNotNull();
        assertThat(saved.getValue().getMatchPercent()).isEqualTo(85);
        verify(nvidia).generateJson(anyString(), anyString(), eq(userId), eq("job-match"));
        verify(scrape, never()).fetchRaw(any());
    }

    @Test
    void deliverForOnboarding_emptyCache_returnsSensiblePartial_withoutScrape() {
        UserProfile profile = onboardedProfile();

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(cvService.activeCvText(userId)).thenReturn("CV");
        when(userJobs.countByUserIdAndDeletedAtIsNull(userId)).thenReturn(0L);
        when(cachedJobPool.loadCandidates(profile, 500)).thenReturn(List.of());
        when(dedup.dedupForPipelineDelivery(userId, List.of())).thenReturn(List.of());
        when(matcher.topN(any(), eq(profile), anyInt())).thenReturn(List.of());

        AtomicInteger terminalStage = new AtomicInteger();
        delivery.deliverForOnboarding(userId, 10, 3, progress -> {
            if (progress.stage() == com.careerops.dto.OnboardingDeliveryDtos.Stage.failed) {
                terminalStage.incrementAndGet();
            }
        });

        verify(scrape, never()).fetchRaw(any());
        assertThat(terminalStage.get()).isEqualTo(1);
    }

    @Test
    void deliver_existingUserWithPipeline_stillCallsScrape() {
        UserProfile profile = onboardedProfile();
        Job job = sampleJob("Backend Engineer", "Beta");

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(scrape.fetchRaw(profile)).thenReturn(List.of(job));
        when(dedup.dedupForPipelineDelivery(eq(userId), any())).thenReturn(List.of());
        when(limits.remaining(userId)).thenReturn(5);
        when(matcher.topN(any(), eq(profile), anyInt())).thenReturn(List.of());

        delivery.deliver(userId, 5);

        verify(scrape).fetchRaw(profile);
        verify(cachedJobPool, never()).loadCandidates(any(), anyInt());
    }

    @Test
    void willUseCachedPoolForOnboarding_trueWhenEmptyPipeline() {
        when(userJobs.countByUserIdAndDeletedAtIsNull(userId)).thenReturn(0L);
        assertThat(delivery.willUseCachedPoolForOnboarding(userId)).isTrue();
    }

    @Test
    void willUseCachedPoolForOnboarding_falseWhenPipelineHasJobs() {
        when(userJobs.countByUserIdAndDeletedAtIsNull(userId)).thenReturn(3L);
        assertThat(delivery.willUseCachedPoolForOnboarding(userId)).isFalse();
    }

    private UserProfile onboardedProfile() {
        UserProfile profile = new UserProfile();
        profile.setUserId(userId);
        profile.setOnboarded(true);
        profile.setTargetRoles(new String[] {"Full Stack Developer"});
        profile.setLocation("Dublin");
        profile.setOpenToRemote(true);
        profile.setMinMatchPercent(40);
        return profile;
    }

    private Job sampleJob(String title, String company) {
        Job job = new Job();
        job.setId(UUID.randomUUID());
        job.setTitle(title);
        job.setCompany(company);
        job.setDescription("Build APIs with Java and Spring");
        return job;
    }
}
