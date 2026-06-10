package com.careerops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OnboardingCvAiParseServiceTest {

    @Mock NvidiaService nvidia;

    private OnboardingCvAiParseService aiParseService;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        aiParseService = new OnboardingCvAiParseService(nvidia, new OnboardingCvParseResultValidator());
    }

    @Test
    void parse_returnsValidatedResultWhenNvidiaSucceeds() throws Exception {
        when(nvidia.isConfigured()).thenReturn(true);
        var json = mapper.readTree("""
            {
              "headline": "Developer",
              "cvMarkdown": "## Summary\\nHello",
              "techStack": ["Java"],
              "workExperience": [],
              "education": [],
              "projects": []
            }
            """);
        when(nvidia.generateJsonWithoutUserConsent(anyString(), anyString(), eq("onboarding-cv-parse")))
            .thenReturn(json);

        Optional<OnboardingCvParseResultValidator.ValidatedAiParse> result =
            aiParseService.parse("Some CV text");

        assertThat(result).isPresent();
        assertThat(result.get().headline()).isEqualTo("Developer");
    }

    @Test
    void parse_emptyWhenNotConfigured() {
        when(nvidia.isConfigured()).thenReturn(false);
        assertThat(aiParseService.parse("CV")).isEmpty();
    }

    @Test
    void parse_emptyWhenJsonExtractorReturnsRawWrapper() throws Exception {
        when(nvidia.isConfigured()).thenReturn(true);
        var json = mapper.readTree("""
            {"raw": "not valid structured output"}
            """);
        when(nvidia.generateJsonWithoutUserConsent(anyString(), anyString(), eq("onboarding-cv-parse")))
            .thenReturn(json);

        assertThat(aiParseService.parse("Some CV text")).isEmpty();
    }
}
