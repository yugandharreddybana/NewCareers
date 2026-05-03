package com.careerops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import com.careerops.service.CvHumanScoreService.CvScoreResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CvHumanScoreServiceTest {

    @Mock
    private ClaudeDirectService claude;

    @Spy
    private ObjectMapper mapper = new ObjectMapper();

    @InjectMocks
    private CvHumanScoreService service;

    @Test
    @DisplayName("ATS score — returns value in 0–100 range")
    void atsScore_inRange() throws Exception {
        String cv = "Experienced Java developer with Spring Boot and Microservices expertise.";
        String jd = "Looking for Java Spring Boot developer with microservices experience.";
        when(claude.generateJson(anyString(), anyString())).thenReturn(mapper.readTree("{\"atsScore\":78,\"humanScore\":65,\"flaggedPhrases\":[]}"));

        CvScoreResult result = service.score(cv, jd);

        assertThat(result.atsScore()).isBetween(0, 100);
    }

    @Test
    @DisplayName("human score — returned correctly from Gemini response")
    void humanScore_returnedCorrectly() throws Exception {
        when(claude.generateJson(anyString(), anyString())).thenReturn(mapper.readTree("{\"atsScore\":80,\"humanScore\":70,\"flaggedPhrases\":[]}"));

        CvScoreResult result = service.score("cv text", "jd text");

        assertThat(result.humanScore()).isEqualTo(70);
    }

    @Test
    @DisplayName("empty CV — returns zero scores gracefully")
    void emptyCv_returnsZeroScores() {
        CvScoreResult result = service.score("", "some job description");
        assertThat(result.atsScore()).isEqualTo(0);
    }
}
