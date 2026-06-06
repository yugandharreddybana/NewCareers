package com.careerops.controller;

import com.careerops.service.AuthService;
import com.careerops.service.GdprExportService;
import com.careerops.service.GoogleOAuthService;
import com.careerops.service.UserAnonymizationService;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.sql.init.mode=never")
class AccountControllerExportTest {

    @Autowired MockMvc mockMvc;

    @MockBean GdprExportService gdprExportService;
    @MockBean UserRepository userRepository;
    @MockBean PasswordEncoder passwordEncoder;
    @MockBean AuthService authService;
    @MockBean UserAnonymizationService anonymizationService;
    @MockBean GoogleOAuthService googleOAuth;

    private static final String INTERNAL_USER_ID = "00000000-0000-0000-0000-000000000002";

    @Test
    @DisplayName("GET /account/export returns attachment with my-data.json")
    void exportReturnsAttachment() throws Exception {
        byte[] payload = "{\"exportedAt\":\"2026-06-05T00:00:00Z\"}".getBytes();
        when(gdprExportService.exportUserDataJson(any(UUID.class), any()))
                .thenReturn(payload);

        mockMvc.perform(get("/account/export")
                .with(com.careerops.security.InternalRequestHeaders.hmac("GET", "/account/export", new byte[0]))
                .header("X-Internal-User-Id", INTERNAL_USER_ID))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"my-data.json\""))
                .andExpect(content().contentType("application/json"))
                .andExpect(content().bytes(payload));
    }
}
