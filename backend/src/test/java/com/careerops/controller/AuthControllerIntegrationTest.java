package com.careerops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Task 143 — AuthController integration test
 * Flow: register → login → access token → protected route → refresh → protected route.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(OrderAnnotation.class)
class AuthControllerIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    private static String accessToken;
    private static String refreshToken;
    private static String userId;

    private static final String EMAIL    = "inttest_" + System.currentTimeMillis() + "@careerops.test";
    private static final String PASSWORD = "N0tPwned!" + System.currentTimeMillis();
    private static final String NAME     = "Integration Tester";
    private static final String USERNAME = "inttest" + System.currentTimeMillis();
    private static final String INTERNAL_SECRET = "test-internal-trust-secret-minimum-32-characters-long";
    private static final String INTERNAL_USER_ID_HEADER = "X-Internal-User-Id";

    @Test @Order(1)
    @DisplayName("1 — register new user")
    void registerNewUser() throws Exception {
        mockMvc.perform(
            post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "name", NAME,
                    "username", USERNAME,
                    "email", EMAIL,
                    "password", PASSWORD
                )))
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").exists())
        .andExpect(jsonPath("$.refreshToken").exists())
        .andExpect(jsonPath("$.user.id").exists());
    }

    @Test @Order(2)
    @DisplayName("2 — login returns access + refresh tokens")
    void loginReturnsTokens() throws Exception {
        MvcResult result = mockMvc.perform(
            post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "email", EMAIL, "password", PASSWORD
                )))
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").exists())
        .andExpect(jsonPath("$.refreshToken").exists())
        .andExpect(jsonPath("$.user.id").exists())
        .andReturn();

        Map<?, ?> body = objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
        accessToken  = (String) body.get("token");
        refreshToken = (String) body.get("refreshToken");
        userId = (String) ((Map<?, ?>) body.get("user")).get("id");
        assertThat(accessToken).isNotBlank();
        assertThat(userId).isNotBlank();
    }

    @Test @Order(3)
    @DisplayName("3 — access protected route with valid token")
    void accessProtectedRouteWithToken() throws Exception {
        mockMvc.perform(
            get("/profile")
                .header("X-Internal-Secret", INTERNAL_SECRET)
                .header(INTERNAL_USER_ID_HEADER, userId)
                .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk());
    }

    @Test @Order(4)
    @DisplayName("4 — refresh token returns new access token")
    void refreshTokenReturnsNewAccessToken() throws Exception {
        MvcResult result = mockMvc.perform(
            post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken)))
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").exists())
        .andReturn();

        Map<?, ?> body = objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
        accessToken = (String) body.get("token");
        refreshToken = (String) body.get("refreshToken");
        assertThat(accessToken).isNotBlank();
    }

    @Test @Order(5)
    @DisplayName("5 — access protected route with refreshed token")
    void accessProtectedRouteWithRefreshedToken() throws Exception {
        mockMvc.perform(
            get("/profile")
                .header("X-Internal-Secret", INTERNAL_SECRET)
                .header(INTERNAL_USER_ID_HEADER, userId)
                .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk());
    }
}
