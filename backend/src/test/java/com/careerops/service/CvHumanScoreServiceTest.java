package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CvHumanScoreServiceTest {

    @Mock
    private AiProviderRouter router;

    @Mock
    private NvidiaService nvidia;

    private final ObjectMapper mapper = new ObjectMapper();
    private CvHumanScoreService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new CvHumanScoreService(router, nvidia, mapper);
    }

    @Test
    @DisplayName("score — returns overallScore in 0–100 range via router when NVIDIA off")
    void score_inRange() throws Exception {
        String cv = "Experienced Java developer with Spring Boot and Microservices expertise.";
        when(nvidia.isConfigured()).thenReturn(false);
        when(router.routePrompt(anyString(), any(UUID.class), anyString()))
                .thenReturn("{\"overallScore\":78,\"humanSummary\":\"Strong CV\"}");

        JsonNode result = service.score(UUID.randomUUID(), cv);

        assertThat(result.path("overallScore").asInt()).isBetween(0, 100);
    }
}
