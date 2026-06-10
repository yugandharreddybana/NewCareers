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
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.TransactionDefinition;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobDeliveryServiceFetchScoreTest {

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

    private JobDeliveryService delivery;
    private final UUID userId = UUID.randomUUID();
    private final ObjectMapper mapper = new ObjectMapper();

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

        lenient().when(fetchSettings.maxAgeDays()).thenReturn(14);
        lenient().when(fetchSettings.batchSize()).thenReturn(10);
        lenient().when(parallelEval.getEvalExecutor()).thenReturn(Runnable::run);

        delivery = new JobDeliveryService(
            scrape, dedup, nvidia, prompts, profiles, userJobs, jobs, cvService, limits, matcher,
            mapper, txManager,
            evaluationValidator,
            org.mockito.Mockito.mock(StructuredJobEvaluationBuilder.class),
            org.mockito.Mockito.mock(EvaluationReportEnrichmentService.class),
            parallelEval,
            org.mockito.Mockito.mock(ProfileReadableFields.class),
            adzuna, indeed, irishJobs, jobsIe, jobsIreland, companyPages, linkedInPublic,
            fetchSettings, cachedJobPool);
        ReflectionTestUtils.setField(delivery, "preRankPool", 25);
    }

    @Test
    void fetchAndStoreOnly_persistsHeuristicMatchWithoutScoreBreakdown() {
        UserProfile profile = onboardedProfile();
        Job job = sampleJob("Backend Engineer", "Acme Corp");
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(scrape.fetchRaw(profile)).thenReturn(List.of(job));
        when(dedup.dedupForPipelineDelivery(userId, List.of(job))).thenReturn(List.of(job));
        when(matcher.topN(any(), eq(profile), eq(50)))
            .thenReturn(List.of(new JobMatchingService.ScoredJob(job, 72, List.of("Java"), List.of())));
        when(userJobs.findByUserIdAndJobId(userId, job.getId())).thenReturn(Optional.empty());
        when(userJobs.findRowIdByUserIdAndJobIdIncludingDeleted(userId, job.getId()))
            .thenReturn(Optional.empty());

        ArgumentCaptor<UserJob> saved = ArgumentCaptor.forClass(UserJob.class);
        when(userJobs.save(saved.capture())).thenAnswer(inv -> inv.getArgument(0));

        delivery.fetchAndStoreOnly(userId);

        assertThat(saved.getValue().getScoreBreakdown()).isNull();
        assertThat(saved.getValue().getMatchPercent()).isEqualTo(72);
        verify(dedup).markSeen(eq(userId), eq(List.of(job)));
        verify(limits, never()).increment(any(), any(Integer.class));
    }

    @Test
    void scoreStoredJobs_runsEvaluateDeepAndIncrementsDailyLimit() {
        UserProfile profile = onboardedProfile();
        Job job = sampleJob("Data Engineer", "Beta Ltd");
        UserJob uj = UserJob.builder()
            .userId(userId)
            .jobId(job.getId())
            .matchPercent(65)
            .build();

        ObjectNode breakdown = mapper.createObjectNode();
        breakdown.put("matchPercent", 88);
        breakdown.put("overallScore", 88);

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(limits.remaining(userId)).thenReturn(5);
        when(userJobs.findUnscoredByUserId(eq(userId), any(Pageable.class))).thenReturn(List.of(uj));
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        when(parallelEval.evaluateDeep(any(), eq(profile), eq(userId), eq("nightly_score")))
            .thenReturn(new ParallelJobEvaluationService.ScoredResult(job, breakdown, 88));
        when(userJobs.save(uj)).thenReturn(uj);

        delivery.scoreStoredJobs(userId, 10);

        assertThat(uj.getScoreBreakdown()).isEqualTo(breakdown);
        assertThat(uj.getMatchPercent()).isEqualTo(88);
        verify(limits).increment(userId, 1);
    }

    private UserProfile onboardedProfile() {
        UserProfile profile = new UserProfile();
        profile.setUserId(userId);
        profile.setOnboarded(true);
        profile.setTargetRoles(new String[] {"Engineer"});
        profile.setMinMatchPercent(40);
        return profile;
    }

    private Job sampleJob(String title, String company) {
        Job job = new Job();
        job.setId(UUID.randomUUID());
        job.setTitle(title);
        job.setCompany(company);
        job.setDescription("Build APIs");
        return job;
    }
}
