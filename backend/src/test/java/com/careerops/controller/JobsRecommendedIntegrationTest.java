package com.careerops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /jobs/recommended must not 500 when mapping native-query timestamps (H2 / Postgres).
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class JobsRecommendedIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    private static final String INTERNAL_SECRET = "test-internal-trust-secret-minimum-32-characters-long";
    private static final String INTERNAL_USER_ID_HEADER = "X-Internal-User-Id";

    @Test
    @DisplayName("GET /jobs/recommended returns 200 for seeded dev user")
    void recommendedForSeededDevUser() throws Exception {
        String userId = "00000000-0000-0000-0000-000000000001";

        mockMvc.perform(
                get("/jobs/recommended")
                    .header("X-Internal-Secret", INTERNAL_SECRET)
                    .header(INTERNAL_USER_ID_HEADER, userId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("GET /jobs/recommended returns 200 for newly registered user")
    void recommendedForNewUser() throws Exception {
        String email = "rec_test_" + System.currentTimeMillis() + "@careerops.test";
        MvcResult reg = mockMvc.perform(
                post("/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of(
                        "name", "Rec Test",
                        "username", "rec" + System.currentTimeMillis(),
                        "email", email,
                        "password", "N0tPwned!" + System.currentTimeMillis()))))
            .andExpect(status().isOk())
            .andReturn();

        Map<?, ?> body = objectMapper.readValue(reg.getResponse().getContentAsString(), Map.class);
        String userId = (String) ((Map<?, ?>) body.get("user")).get("id");

        mockMvc.perform(
                get("/jobs/recommended")
                    .header("X-Internal-Secret", INTERNAL_SECRET)
                    .header(INTERNAL_USER_ID_HEADER, userId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }
}
