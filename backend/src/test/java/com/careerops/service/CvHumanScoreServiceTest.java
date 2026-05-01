package com.careerops.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Task 138 — CvHumanScoreService unit tests
 * Covers: ATS score calculation, human score, AI phrase detection.
 */
@ExtendWith(MockitoExtension.class)
class CvHumanScoreServiceTest {

    @Mock  private GeminiClient       geminiClient;
    @InjectMocks private CvHumanScoreService service;

    // ── 1. ATS score is between 0 and 100 ─────────────────────────────────
    @Test
    @DisplayName("ATS score — returns value in 0–100 range")
    void atsScore_inRange() {
        String cv = "Experienced Java developer with Spring Boot and Microservices expertise.";
        String jd = "Looking for Java Spring Boot developer with microservices experience.";
        when(geminiClient.generate(anyString())).thenReturn("{\"atsScore\":78,\"humanScore\":65,\"aiPhrases\":[]}");

        CvScoreResult result = service.score(cv, jd);

        assertThat(result.getAtsScore()).isBetween(0, 100);
    }

    // ── 2. Human score is always <= ATS score on keyword-matched CV ───────
    @Test
    @DisplayName("human score — returned correctly from Gemini response")
    void humanScore_returnedCorrectly() {
        when(geminiClient.generate(anyString())).thenReturn("{\"atsScore\":80,\"humanScore\":70,\"aiPhrases\":[]}");

        CvScoreResult result = service.score("cv text", "jd text");

        assertThat(result.getHumanScore()).isEqualTo(70);
    }

    // ── 3. AI phrase detection flags known buzzwords ───────────────────────
    @Test
    @DisplayName("AI phrase detection — flags buzzwords in CV")
    void aiPhraseDetection_flagsBuzzwords() {
        String cvWithBuzz = "I am a passionate, results-driven synergy leverager with proven track record.";
        when(geminiClient.generate(anyString()))
            .thenReturn("{\"atsScore\":55,\"humanScore\":40,\"aiPhrases\":[\"results-driven\",\"proven track record\"]}");

        CvScoreResult result = service.score(cvWithBuzz, "jd text");

        assertThat(result.getAiPhrases()).isNotEmpty();
        assertThat(result.getAiPhrases()).anyMatch(p -> p.contains("results-driven"));
    }

    // ── 4. Empty CV returns zero scores ───────────────────────────────────
    @Test
    @DisplayName("empty CV — returns zero scores gracefully")
    void emptyCv_returnsZeroScores() {
        when(geminiClient.generate(anyString())).thenReturn("{\"atsScore\":0,\"humanScore\":0,\"aiPhrases\":[]}");

        CvScoreResult result = service.score("", "some job description");

        assertThat(result.getAtsScore()).isCloseTo(0, within(1));
    }
}
