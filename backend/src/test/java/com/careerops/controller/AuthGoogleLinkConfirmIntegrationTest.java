package com.careerops.controller;

import com.careerops.model.User;
import com.careerops.repository.UserRepository;
import com.careerops.service.GoogleOAuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthGoogleLinkConfirmIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;

    @MockBean GoogleOAuthService googleOAuth;

    @Test
    @DisplayName("locked user cannot confirm Google link via HTTP (LSA-T06)")
    void lockedUserCannotConfirmGoogleLink() throws Exception {
        String suffix = Long.toString(System.nanoTime());
        String email = "linklock_" + suffix + "@careerops.test";
        String password = "Password1!link";

        User user = users.save(User.builder()
                .name("Link Lock User")
                .username("linklock" + suffix)
                .email(email)
                .passwordHash(encoder.encode(password))
                .build());
        user.setLockedUntil(Instant.now().plus(15, ChronoUnit.MINUTES));
        users.save(user);

        when(googleOAuth.verifyIdToken(any())).thenReturn(
                new GoogleOAuthService.GoogleIdentity("google-sub-" + suffix, email, "Link Lock User", true));

        mockMvc.perform(post("/auth/google/link/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "idToken", "a".repeat(120),
                                "password", password))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }
}
