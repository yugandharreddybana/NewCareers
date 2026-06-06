package com.careerops.service;

import com.careerops.model.AgentResult;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SkillLocalFallbackServiceTest {

    @Mock UserProfileRepository profiles;
    @Mock UserJobRepository userJobs;
    @Mock JobRepository jobs;
    @Mock CvService cvService;
    @Mock CvSkillExtractionService skillExtraction;
    @Mock JobMatchingService jobMatcher;
    @Mock EvaluationReportValidator evaluationValidator;
    @Mock UserRepository users;
    @Mock TailorResumePendingStore tailorResumePending;

    @InjectMocks SkillLocalFallbackService fallback;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void tailorResume_returnsStructuredOutputWithoutAi() throws Exception {
        StructuredJobEvaluationBuilder evaluationBuilder = new StructuredJobEvaluationBuilder(
            skillExtraction, new UserJobSkillMatchService(skillExtraction, null, null, null, null, jobMatcher),
            jobMatcher, evaluationValidator, mapper);
        TailorResumeHtmlRenderer htmlRenderer = new TailorResumeHtmlRenderer();
        TailorResumeAiService tailorAi = org.mockito.Mockito.mock(TailorResumeAiService.class);
        when(tailorAi.tryBuild(any(), any(), any(), any(), any())).thenReturn(Optional.empty());
        TailorResumeBuilderService tailorBuilder =
            new TailorResumeBuilderService(skillExtraction, htmlRenderer, tailorAi, users, mapper);
        fallback = new SkillLocalFallbackService(
            mapper, profiles, userJobs, jobs, cvService, skillExtraction,
            jobMatcher, evaluationValidator, evaluationBuilder, tailorBuilder, tailorResumePending);

        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        UUID jobId = UUID.randomUUID();

        UserProfile profile = new UserProfile();
        profile.setTechStack(new String[] { "React", "TypeScript" });

        Job job = new Job();
        job.setId(jobId);
        job.setTitle("Software Engineer");
        job.setCompany("Acme");
        job.setDescription("We need React and TypeScript experience.");

        UserJob uj = new UserJob();
        uj.setJobId(jobId);

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(cvService.activeCvText(userId)).thenReturn("""
            ## Summary
            Full stack engineer with React and TypeScript.

            ## Experience
            - Built products with React and TypeScript for 5 years at Acme.

            ## Education
            BSc Computer Science
            """);
        when(userJobs.findById(userJobId)).thenReturn(Optional.of(uj));
        when(jobs.findById(jobId)).thenReturn(Optional.of(job));
        when(skillExtraction.extractForUser(any(), any(), any()))
            .thenReturn(List.of("React", "TypeScript", "Java"));
        when(skillExtraction.matchedInJob(any(), any())).thenReturn(List.of("React", "TypeScript"));
        when(skillExtraction.unmatchedInJob(any(), any())).thenReturn(List.of("Java"));

        Optional<AgentResult> result = fallback.tryFallback("tailor-resume", userId, userJobId, null);

        assertThat(result).isPresent();
        assertThat(result.get()).isInstanceOf(AgentResult.Done.class);
        var json = mapper.readTree(((AgentResult.Done) result.get()).text());
        assertThat(json.path("summary").asText()).isNotBlank();
        assertThat(json.path("sections").isArray()).isTrue();
        assertThat(json.path("keywordsAdded").size()).isGreaterThan(0);
    }
}
