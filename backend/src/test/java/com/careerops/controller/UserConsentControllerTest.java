package com.careerops.controller;

import com.careerops.dto.ConsentDtos.WithdrawAiConsentResult;
import com.careerops.model.UserConsent;
import com.careerops.model.UserConsent.ConsentType;
import com.careerops.service.UserConsentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.sql.init.mode=never")
class UserConsentControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean UserConsentService consentService;

    private static final String INTERNAL_USER_ID = "00000000-0000-0000-0000-000000000002";

    @Test
    @DisplayName("DELETE /user/consent/ai returns withdrawal response")
    void deleteAiConsentReturns200() throws Exception {
        UUID consentId = UUID.randomUUID();
        Instant acceptedAt = Instant.parse("2026-06-06T10:00:00Z");
        when(consentService.withdrawAiConsent(eq(UUID.fromString(INTERNAL_USER_ID)), any()))
                .thenReturn(new WithdrawAiConsentResult(
                        UserConsent.builder()
                                .id(consentId)
                                .userId(UUID.fromString(INTERNAL_USER_ID))
                                .consentType(ConsentType.AI_PROCESSING)
                                .version("v1.0")
                                .accepted(false)
                                .acceptedAt(acceptedAt)
                                .build(),
                        3));

        mockMvc.perform(delete("/user/consent/ai")
                .with(com.careerops.security.InternalRequestHeaders.hmac(
                        "DELETE", "/user/consent/ai", new byte[0]))
                .header("X-Internal-User-Id", INTERNAL_USER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(consentId.toString()))
                .andExpect(jsonPath("$.consentType").value("AI_PROCESSING"))
                .andExpect(jsonPath("$.accepted").value(false))
                .andExpect(jsonPath("$.skillRunsDeleted").value(3));
    }
}
