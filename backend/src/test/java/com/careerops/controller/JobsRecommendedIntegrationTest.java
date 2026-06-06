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

import com.careerops.support.OnboardingVerificationTestSupport;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

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

    private static final String INTERNAL_USER_ID_HEADER = "X-Internal-User-Id";

    @Test
    @DisplayName("GET /jobs/recommended returns 200 for seeded dev user")
    void recommendedForSeededDevUser() throws Exception {
        String userId = "00000000-0000-0000-0000-000000000001";

        mockMvc.perform(
                get("/jobs/recommended")
                    .with(com.careerops.security.InternalRequestHeaders.hmac("GET", "/jobs/recommended", new byte[0]))
                    .header(INTERNAL_USER_ID_HEADER, userId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("GET /jobs/recommended returns 200 for newly registered user")
    void recommendedForNewUser() throws Exception {
        String email = "rec_test_" + System.currentTimeMillis() + "@careerops.test";
        UUID verificationId = OnboardingVerificationTestSupport.verifyEmailForTest(
                mockMvc, objectMapper, email);
        Map<String, Object> registerBody = new HashMap<>();
        registerBody.put("name", "Rec Test");
        registerBody.put("username", "rec" + System.currentTimeMillis());
        registerBody.put("email", email);
        registerBody.put("password", "N0tPwned!" + System.currentTimeMillis());
        registerBody.put("emailVerificationId", verificationId.toString());
        registerBody.put("consents", OnboardingVerificationTestSupport.defaultSignupConsents());

        MvcResult reg = mockMvc.perform(
                post("/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(registerBody)))
            .andExpect(status().isOk())
            .andReturn();

        Map<?, ?> body = objectMapper.readValue(reg.getResponse().getContentAsString(), Map.class);
        String userId = (String) ((Map<?, ?>) body.get("user")).get("id");

        mockMvc.perform(
                get("/jobs/recommended")
                    .with(com.careerops.security.InternalRequestHeaders.hmac("GET", "/jobs/recommended", new byte[0]))
                    .header(INTERNAL_USER_ID_HEADER, userId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }
}
