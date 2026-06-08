package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.sources.*;
import com.careerops.service.sources.company.CompanyCareerSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobDeliveryServiceIrishJobsTest {

    @Mock JobScrapeService scrape;
    @Mock DeduplicationService dedup;
    @Mock NvidiaService nvidia;
    @Mock SkillPromptLibrary prompts;
    @Mock UserProfileRepository profiles;
    @Mock UserJobRepository userJobs;
    @Mock com.careerops.repository.JobRepository jobs;
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

    private JobDeliveryService delivery;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(fetchSettings.maxAgeDays()).thenReturn(14);
        delivery = new JobDeliveryService(
            scrape, dedup, nvidia, prompts, profiles, userJobs, jobs, cvService, limits, matcher,
            new ObjectMapper(), org.mockito.Mockito.mock(PlatformTransactionManager.class),
            evaluationValidator,
            org.mockito.Mockito.mock(StructuredJobEvaluationBuilder.class),
            org.mockito.Mockito.mock(EvaluationReportEnrichmentService.class),
            parallelEval,
            adzuna, indeed, irishJobs, jobsIe, jobsIreland, companyPages, linkedInPublic,
            fetchSettings);
    }

    @Test
    void deliverFromIrishJobs_emptyListing_throwsServiceUnavailable() {
        UserProfile profile = onboardedProfile();
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(irishJobs.hasBudget()).thenReturn(true);
        when(irishJobs.fetch(profile)).thenReturn(List.of());

        assertThatThrownBy(() -> delivery.deliverFromIrishJobs(userId, 10))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> org.assertj.core.api.Assertions.assertThat(((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    void deliverFromIrishJobs_noProfile_throwsBadRequest() {
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());
        when(irishJobs.hasBudget()).thenReturn(true);

        assertThatThrownBy(() -> delivery.deliverFromIrishJobs(userId, 10))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> org.assertj.core.api.Assertions.assertThat(((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    private UserProfile onboardedProfile() {
        UserProfile p = new UserProfile();
        p.setUserId(userId);
        p.setOnboarded(true);
        p.setTargetRoles(new String[]{"software engineer"});
        p.setTechStack(new String[]{"java"});
        p.setLocation("Dublin, Ireland");
        return p;
    }
}
