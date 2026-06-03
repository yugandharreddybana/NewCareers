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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EvaluationReportEnrichmentServiceTest {

    @Mock private StructuredJobEvaluationBuilder structuredBuilder;

    private EvaluationReportEnrichmentService enrichment;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        enrichment = new EvaluationReportEnrichmentService(structuredBuilder);
    }

    @Test
    void isCompleteReport_falseWhenSectionsMissing() throws Exception {
        JsonNode thin = mapper.readTree("""
            {"matchPercent":80,"dimensions":[{"key":"role_fit","score":4}]}
            """);
        assertThat(enrichment.isCompleteReport(thin)).isFalse();
    }

    @Test
    void ensureComplete_mergesBuiltSectionsIntoThinReport() throws Exception {
        UUID userId = UUID.randomUUID();
        Job job = Job.builder().id(UUID.randomUUID()).title("Dev").company("Co").build();
        UserProfile profile = UserProfile.builder().userId(userId).build();

        JsonNode thin = mapper.readTree("""
            {"matchPercent":72,"humanSummary":"Short AI summary","dimensions":[]}
            """);

        JsonNode full = mapper.readTree("""
            {
              "matchPercent": 75,
              "sections": {
                "executiveSummary": "A text",
                "backgroundMatch": "B text",
                "positioningStrategy": "C text",
                "compensationAndMarket": "D text",
                "tailoringPlan": "E text",
                "interviewPrep": "F text"
              },
              "dimensions": [
                {"key":"role_fit","score":4.0},
                {"key":"skills_match","score":4.0},
                {"key":"experience_depth","score":4.0},
                {"key":"cv_evidence","score":4.0},
                {"key":"location_work_model","score":4.0},
                {"key":"compensation","score":4.0},
                {"key":"sponsorship_visa","score":4.0},
                {"key":"company_stage","score":4.0},
                {"key":"growth_learning","score":4.0},
                {"key":"culture_signals","score":4.0}
              ],
              "evaluationStatus": "complete_local"
            }
            """);

        when(structuredBuilder.build(eq(userId), eq(job), eq(profile), any(), isNull(), anyString(), eq("complete_local")))
            .thenReturn(full);

        JsonNode result = enrichment.ensureComplete(userId, job, profile, "cv", thin, "test");
        assertThat(enrichment.hasAllSections(result)).isTrue();
        assertThat(result.path("dimensions").size()).isGreaterThanOrEqualTo(10);
        assertThat(result.path("humanSummary").asText()).isEqualTo("Short AI summary");
    }
}
