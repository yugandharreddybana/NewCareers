package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class StructuredJobEvaluationBuilderTest {

    @Mock CvService cvService;

    CvSkillExtractionService skillExtraction;
    JobMatchingService jobMatcher;
    StructuredJobEvaluationBuilder builder;
    ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        skillExtraction = new CvSkillExtractionService();
        jobMatcher = new JobMatchingService(Clock.fixed(Instant.parse("2026-05-29T12:00:00Z"), ZoneOffset.UTC));
        UserJobSkillMatchService skillMatchService = new UserJobSkillMatchService(
            skillExtraction, null, null, null, null, jobMatcher);
        builder = new StructuredJobEvaluationBuilder(
            skillExtraction, skillMatchService, jobMatcher, new EvaluationReportValidator(mapper), mapper, false);
    }

    @Test
    void build_producesRichV2Report() {
        UUID userId = UUID.randomUUID();
        UserProfile profile = new UserProfile();
        profile.setTechStack(new String[] { "React", "TypeScript", "Java" });
        profile.setTargetRoles(new String[] { "Software Engineer" });
        profile.setLocation("Dublin, Ireland");
        profile.setSalaryMin(60000);
        profile.setMinMatchPercent(60);

        Job job = new Job();
        job.setTitle("Senior Software Engineer");
        job.setCompany("TechWave");
        job.setLocation("Dublin");
        job.setDescription("""
            We require 5+ years experience with React and TypeScript.
            You will build customer-facing products in an agile team.
            Salary €70k–€90k. Remote-friendly hybrid.
            """);

        String cv = "Senior engineer with React, TypeScript, and Java. Led delivery of SaaS products.";

        JsonNode report = builder.build(userId, job, profile, cv, null, "test", "complete_local");

        assertThat(report.path("evaluationStatus").asText()).isIn("complete", "complete_local");
        assertThat(report.path("sections").path("executiveSummary").asText()).hasSizeGreaterThan(80);
        assertThat(report.path("sections").path("backgroundMatch").asText()).isNotBlank();
        assertThat(report.path("sections").path("interviewPrep").asText()).isNotBlank();
        assertThat(report.path("dimensions")).hasSize(10);
        assertThat(report.path("matchedSkills").size()).isGreaterThan(0);
        assertThat(report.path("applyScore").asDouble()).isGreaterThan(0);
    }
}
