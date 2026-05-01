package com.careerops.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Task 142 — SkillsController full-HTTP integration tests
 * POST /skills/start for each of 14 skills returns expected shape.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SkillsControllerIntegrationTest {

    @Autowired MockMvc mockMvc;

    private static final String USER_JOB_ID = "test-job-001";

    @ParameterizedTest(name = "POST /skills/start — skill: {0}")
    @ValueSource(strings = {
        "evaluate", "tailor-resume", "research", "outreach",
        "apply", "prep-interview", "compare", "triage", "scan",
        "salary-negotiation", "culture-fit", "linkedin-optimize",
        "cover-letter", "skills-gap-plan"
    })
    @WithMockUser(username = "testuser", roles = "USER")
    void postSkillStart_returnsExpectedShape(String skillName) throws Exception {
        String body = """
            {
              "userJobId": "%s",
              "skillName": "%s"
            }
            """.formatted(USER_JOB_ID, skillName);

        mockMvc.perform(
            post("/api/skills/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
        )
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.status").exists())
        .andExpect(jsonPath("$.skillName").value(skillName));
    }

    @Test
    @DisplayName("POST /skills/start — unauthenticated returns 401")
    void postSkillStart_unauthenticated_returns401() throws Exception {
        mockMvc.perform(
            post("/api/skills/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userJobId\":\"x\",\"skillName\":\"evaluate\"}")
        )
        .andExpect(status().isUnauthorized());
    }
}
