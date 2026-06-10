package com.careerops.service;

import com.careerops.dto.AuthDtos.OnboardingCvParseResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OnboardingCvParseServiceAiTest {

    @Mock CvParserService parser;
    @Mock com.careerops.util.FileUtil fileUtil;
    @Mock OnboardingCvAiParseService aiParseService;
    @Mock CvSkillExtractionService skillExtraction;

    private OnboardingCvParseService service;
    private final OnboardingCvParseResultValidator validator = new OnboardingCvParseResultValidator();

    @BeforeEach
    void setUp() {
        service = new OnboardingCvParseService(parser, fileUtil, aiParseService, validator, skillExtraction);
        ReflectionTestUtils.setField(service, "aiParseEnabled", true);
        ReflectionTestUtils.setField(service, "aiParseTimeoutMs", 60_000L);
    }

    @Test
    void parse_withAiSuccess_usesAiSourceAndTechStack() throws Exception {
        String cvText = """
            PROFESSIONAL EXPERIENCE
            Engineer Jan 2020 – Present
            Acme Corp
            ▪ Built APIs.

            TECHNICAL SKILLS
            Java, Spring Boot
            """;
        when(fileUtil.sanitizeFilename(anyString())).thenReturn("cv.pdf");
        when(parser.extract(org.mockito.ArgumentMatchers.any(), anyString(), anyString())).thenReturn(cvText);
        when(skillExtraction.extractFromSkillsSection(cvText)).thenReturn(List.of("Spring Boot"));

        var aiResult = new OnboardingCvParseResultValidator.ValidatedAiParse(
            "## Summary\nAI markdown",
            "Senior Engineer",
            List.of(new com.careerops.dto.AuthDtos.OnboardingCvParseWorkEntry(
                "Engineer", "Acme", "2020-01", "", true, "Built APIs", "Dublin")),
            List.of(),
            List.of(),
            List.of("React", "TypeScript"),
            List.of("Backend Engineer", "Software Engineer"),
            "https://linkedin.com/in/test",
            null,
            null
        );
        when(aiParseService.parse(cvText)).thenReturn(Optional.of(aiResult));

        MockMultipartFile file = pdfFile();
        OnboardingCvParseResponse response = service.parse(file, OnboardingCvParseService.ParseOptions.withAi());

        assertThat(response.parseSource()).isEqualTo("ai");
        assertThat(response.workExperience()).hasSize(1);
        assertThat(response.headline()).isEqualTo("Senior Engineer");
        assertThat(response.extractedTechStack()).contains("React", "TypeScript", "Spring Boot");
        assertThat(response.extractedTargetRoles()).containsExactly("Backend Engineer", "Software Engineer");
        assertThat(response.parseWarnings()).isEmpty();
    }

    @Test
    void parse_aiFailure_fallsBackToRegexWithWarning() throws Exception {
        String cvText = """
            PROFESSIONAL EXPERIENCE
            Engineer Jan 2020 – Present
            Acme Corp
            ▪ Built APIs.
            """;
        when(fileUtil.sanitizeFilename(anyString())).thenReturn("cv.pdf");
        when(parser.extract(org.mockito.ArgumentMatchers.any(), anyString(), anyString())).thenReturn(cvText);
        when(skillExtraction.extractFromSkillsSection(cvText)).thenReturn(List.of());
        when(aiParseService.parse(cvText)).thenReturn(Optional.empty());

        OnboardingCvParseResponse response = service.parse(pdfFile(), OnboardingCvParseService.ParseOptions.withAi());

        assertThat(response.parseSource()).isEqualTo("regex");
        assertThat(response.parseWarnings()).isNotEmpty();
        assertThat(response.workExperience()).isNotEmpty();
        assertThat(response.extractedTargetRoles()).isEmpty();
    }

    @Test
    void parse_aiTimeout_fallsBackToRegexWithTimeoutWarning() throws Exception {
        ReflectionTestUtils.setField(service, "aiParseTimeoutMs", 50L);
        String cvText = """
            PROFESSIONAL EXPERIENCE
            Engineer Jan 2020 – Present
            Acme Corp
            ▪ Built APIs.
            """;
        when(fileUtil.sanitizeFilename(anyString())).thenReturn("cv.pdf");
        when(parser.extract(org.mockito.ArgumentMatchers.any(), anyString(), anyString())).thenReturn(cvText);
        when(skillExtraction.extractFromSkillsSection(cvText)).thenReturn(List.of());
        when(aiParseService.parse(cvText)).thenAnswer(inv -> {
            Thread.sleep(500);
            return Optional.empty();
        });

        OnboardingCvParseResponse response = service.parse(pdfFile(), OnboardingCvParseService.ParseOptions.withAi());

        assertThat(response.parseSource()).isEqualTo("regex");
        assertThat(response.parseWarnings()).anyMatch(w -> w.toLowerCase().contains("timed out"));
        assertThat(response.workExperience()).isNotEmpty();
    }

    @Test
    void parse_regexOnly_skipsAiCall() throws Exception {
        String cvText = """
            PROFESSIONAL EXPERIENCE
            Engineer Jan 2020 – Present
            Acme Corp
            """;
        when(fileUtil.sanitizeFilename(anyString())).thenReturn("cv.pdf");
        when(parser.extract(org.mockito.ArgumentMatchers.any(), anyString(), anyString())).thenReturn(cvText);
        when(skillExtraction.extractFromSkillsSection(cvText)).thenReturn(List.of());

        OnboardingCvParseResponse response = service.parse(pdfFile(), OnboardingCvParseService.ParseOptions.regexOnly());

        assertThat(response.parseSource()).isEqualTo("regex");
        verify(aiParseService, never()).parse(anyString());
    }

    private static MockMultipartFile pdfFile() {
        byte[] pdfMagic = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34 };
        return new MockMultipartFile(
            "file",
            "cv.pdf",
            "application/pdf",
            pdfMagic
        );
    }
}
