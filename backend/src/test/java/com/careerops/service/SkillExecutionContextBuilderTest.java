package com.careerops.service;

import com.careerops.dto.SkillExecutionContext;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.JobWatchlistRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.careerops.model.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SkillExecutionContextBuilderTest {

    @Mock UserProfileRepository profiles;
    @Mock UserRepository users;
    @Mock UserJobRepository userJobs;
    @Mock JobRepository jobs;
    @Mock CvService cvService;
    @Mock SkillRunRepository skillRuns;
    @Mock JobWatchlistRepository watchlist;
    @Mock CompanyWebResearchService companyWebResearch;
    @Mock ProfileReadableFields profileFields;

    SkillExecutionContextBuilder builder;
    UUID userId = UUID.randomUUID();
    UUID userJobId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        builder = new SkillExecutionContextBuilder(
                profiles, users, userJobs, jobs, cvService, skillRuns, watchlist,
                companyWebResearch, profileFields, new ObjectMapper());
    }

    @Test
    void build_includesProfileCvAndJob() {
        UserProfile profile = new UserProfile();
        profile.setTargetRoles(new String[]{"Backend Engineer"});
        profile.setTechStack(new String[]{"Java", "Spring"});
        profile.setLocation("Dublin");
        profile.setSalaryMin(80000);
        profile.setSalaryMax(100000);
        profile.setExperienceLevel("senior");
        profile.setSponsorshipRequired(false);
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(cvService.activeCvText(userId)).thenReturn("Jane Doe\n5 years Java");

        UserJob uj = new UserJob();
        uj.setJobId(jobId);
        Job job = new Job();
        job.setTitle("Senior Java Dev");
        job.setCompany("Acme");
        job.setLocation("Dublin");
        job.setDescription("Build APIs");
        when(userJobs.findByIdAndUserId(userJobId, userId)).thenReturn(Optional.of(uj));
        when(jobs.findById(jobId)).thenReturn(Optional.of(job));

        SkillExecutionContext ctx = builder.build(userId, userJobId, "evaluate");
        String result = ctx.toInlineContext();

        assertThat(result).contains("PRE-LOADED CONTEXT");
        assertThat(result).contains("do NOT call read_profile");
        assertThat(result).contains("USER PROFILE");
        assertThat(result).contains("target_roles: [Backend Engineer]");
        assertThat(result).contains("USER CV/RESUME");
        assertThat(result).contains("Jane Doe");
        assertThat(result).contains("JOB POSTING");
        assertThat(result).contains("title: Senior Java Dev");
        assertThat(result).contains("company: Acme");
        assertThat(ctx.userId()).isEqualTo(userId);
        assertThat(ctx.userJobId()).isEqualTo(userJobId);
        assertThat(ctx.skillName()).isEqualTo("evaluate");
    }

    @Test
    void build_truncatesLongCv() {
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());
        when(cvService.activeCvText(userId)).thenReturn("x".repeat(7000));

        String result = builder.build(userId, null, "tailor-resume").toInlineContext();

        assertThat(result).contains("...[CV truncated]");
        assertThat(result).doesNotContain("x".repeat(7000));
    }

    @Test
    void build_survivesProfileRepositoryFailure() {
        when(profiles.findByUserId(userId)).thenThrow(new RuntimeException("db down"));
        when(cvService.activeCvText(userId)).thenReturn("cv");

        String result = builder.build(userId, null, "evaluate").toInlineContext();

        assertThat(result).contains("USER CV/RESUME");
        assertThat(result).doesNotContain("USER PROFILE");
    }

    @Test
    void build_nullUserJobId_omitsJobSection() {
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());
        when(cvService.activeCvText(userId)).thenReturn("cv");

        String result = builder.build(userId, null, "evaluate").toInlineContext();

        assertThat(result).doesNotContain("JOB POSTING");
    }
}
