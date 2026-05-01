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

    private static final String EMAIL    = "inttest_" + System.currentTimeMillis() + "@careerops.test";
    private static final String PASSWORD = "Test@1234";
    private static final String NAME     = "Integration Tester";

    @Test @Order(1)
    @DisplayName("1 — register new user")
    void registerNewUser() throws Exception {
        mockMvc.perform(
            post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "name", NAME, "email", EMAIL, "password", PASSWORD
                )))
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").exists());
    }

    @Test @Order(2)
    @DisplayName("2 — login returns access + refresh tokens")
    void loginReturnsTokens() throws Exception {
        MvcResult result = mockMvc.perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "email", EMAIL, "password", PASSWORD
                )))
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").exists())
        .andExpect(jsonPath("$.refreshToken").exists())
        .andReturn();

        Map<?, ?> body = objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
        accessToken  = (String) body.get("accessToken");
        refreshToken = (String) body.get("refreshToken");
        assertThat(accessToken).isNotBlank();
    }

    @Test @Order(3)
    @DisplayName("3 — access protected route with valid token")
    void accessProtectedRouteWithToken() throws Exception {
        mockMvc.perform(
            get("/api/profile")
                .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk());
    }

    @Test @Order(4)
    @DisplayName("4 — refresh token returns new access token")
    void refreshTokenReturnsNewAccessToken() throws Exception {
        MvcResult result = mockMvc.perform(
            post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken)))
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").exists())
        .andReturn();

        Map<?, ?> body = objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
        accessToken = (String) body.get("accessToken");
        assertThat(accessToken).isNotBlank();
    }

    @Test @Order(5)
    @DisplayName("5 — access protected route with refreshed token")
    void accessProtectedRouteWithRefreshedToken() throws Exception {
        mockMvc.perform(
            get("/api/profile")
                .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk());
    }
}
