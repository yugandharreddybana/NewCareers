package com.careerops.service;

import com.careerops.dto.CareerMemoryDtos.MemoryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TailorResumeSkillPromptTest {

    @Mock CareerMemoryService careerMemoryService;
    @Mock TokenUsageService tokenUsageService;

    private SkillPromptLibrary library;

    @BeforeEach
    void setUp() {
        library = new SkillPromptLibrary(careerMemoryService);
        when(careerMemoryService.listEnabled(any())).thenReturn(List.<MemoryResponse>of());
        library.init();
    }

    @Test
    void buildFullSystemPrompt_includesBundledTailorSkillMd() {
        String prompt = library.buildFullSystemPrompt("tailor-resume", UUID.randomUUID());
        assertThat(prompt).contains("Tailor Your Resume");
        assertThat(prompt).contains("Professional Summary");
        assertThat(prompt).contains("Experience Section");
        assertThat(prompt).contains("Skills Section");
        assertThat(prompt).contains("REFERENCE: ats-rules.md");
    }

    @Test
    void buildBackendSkillSystemPrompt_includesEvaluateContractAndBackendBlock() {
        String prompt = library.buildBackendSkillSystemPrompt("evaluate", UUID.randomUUID());
        assertThat(prompt).contains("Evaluate");
        assertThat(prompt).contains("BACKEND EXECUTION");
        assertThat(prompt).contains("EvaluationReportV2");
        assertThat(prompt).contains("REFERENCE: scoring-rubric.md");
    }

    @Test
    void tailorAiService_usesSkillLibrary() {
        UserPlanTierService planTierService = org.mockito.Mockito.mock(UserPlanTierService.class);
        TailorResumeAiService ai = new TailorResumeAiService(
            null,
            new CvSkillExtractionService(),
            library,
            new com.fasterxml.jackson.databind.ObjectMapper(),
            tokenUsageService,
            planTierService);
        String system = ai.skillSystemPrompt(UUID.randomUUID());
        assertThat(system).contains("BACKEND EXECUTION");
        assertThat(system).contains("Tailor Your Resume");
        assertThat(system).contains("Step 3");
    }
}
