package com.careerops.controller;

import com.careerops.dto.ConsentDtos.ConsentStatusResponse;
import com.careerops.dto.ConsentDtos.ConsentTypeStatus;
import com.careerops.exception.ApiException;
import com.careerops.model.UserConsent;
import com.careerops.model.UserConsent.ConsentType;
import com.careerops.service.UserConsentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.sql.init.mode=never")
class ConsentControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean UserConsentService consentService;

    private static final String INTERNAL_USER_ID = "00000000-0000-0000-0000-000000000002";

    @Test
    @DisplayName("GET /consents returns current status")
    void getConsentsReturnsStatus() throws Exception {
        Instant acceptedAt = Instant.parse("2026-06-05T12:00:00Z");
        when(consentService.getStatus(UUID.fromString(INTERNAL_USER_ID)))
                .thenReturn(new ConsentStatusResponse(
                        new ConsentTypeStatus(true, "v1.0", acceptedAt),
                        new ConsentTypeStatus(true, "v1.0", acceptedAt),
                        new ConsentTypeStatus(false, "v1.0", acceptedAt),
                        new ConsentTypeStatus(false, "v1.0", acceptedAt)));

        mockMvc.perform(get("/consents")
                .with(com.careerops.security.InternalRequestHeaders.hmac("GET", "/consents", new byte[0]))
                .header("X-Internal-User-Id", INTERNAL_USER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.essential.accepted").value(true))
                .andExpect(jsonPath("$.aiProcessing.accepted").value(true))
                .andExpect(jsonPath("$.marketing.accepted").value(false));
    }

    @Test
    @DisplayName("POST /consents marketing accepted true returns 201")
    void postMarketingAcceptedReturns201() throws Exception {
        UUID consentId = UUID.randomUUID();
        Instant acceptedAt = Instant.parse("2026-06-05T12:00:00Z");
        when(consentService.updateConsent(
                eq(UUID.fromString(INTERNAL_USER_ID)),
                eq(ConsentType.MARKETING),
                eq("v1.0"),
                eq(true),
                any()))
                .thenReturn(UserConsent.builder()
                        .id(consentId)
                        .userId(UUID.fromString(INTERNAL_USER_ID))
                        .consentType(ConsentType.MARKETING)
                        .version("v1.0")
                        .accepted(true)
                        .acceptedAt(acceptedAt)
                        .build());

        String marketingBody = objectMapper.writeValueAsString(Map.of(
                "consentType", "MARKETING",
                "version", "v1.0",
                "accepted", true));
        mockMvc.perform(post("/consents")
                .with(com.careerops.security.InternalRequestHeaders.hmac("POST", "/consents", marketingBody))
                .header("X-Internal-User-Id", INTERNAL_USER_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(marketingBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(consentId.toString()))
                .andExpect(jsonPath("$.consentType").value("MARKETING"))
                .andExpect(jsonPath("$.accepted").value(true));
    }

    @Test
    @DisplayName("POST /consents AI_PROCESSING withdrawal returns 201")
    void postAiProcessingWithdrawalReturns201() throws Exception {
        UUID consentId = UUID.randomUUID();
        when(consentService.updateConsent(
                eq(UUID.fromString(INTERNAL_USER_ID)),
                eq(ConsentType.AI_PROCESSING),
                eq("v1.0"),
                eq(false),
                any()))
                .thenReturn(UserConsent.builder()
                        .id(consentId)
                        .userId(UUID.fromString(INTERNAL_USER_ID))
                        .consentType(ConsentType.AI_PROCESSING)
                        .version("v1.0")
                        .accepted(false)
                        .acceptedAt(Instant.now())
                        .build());

        String aiBody = objectMapper.writeValueAsString(Map.of(
                "consentType", "AI_PROCESSING",
                "version", "v1.0",
                "accepted", false));
        mockMvc.perform(post("/consents")
                .with(com.careerops.security.InternalRequestHeaders.hmac("POST", "/consents", aiBody))
                .header("X-Internal-User-Id", INTERNAL_USER_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(aiBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.consentType").value("AI_PROCESSING"))
                .andExpect(jsonPath("$.accepted").value(false));
    }

    @Test
    @DisplayName("POST /consents ESSENTIAL returns 400")
    void postEssentialReturns400() throws Exception {
        when(consentService.updateConsent(
                any(), eq(ConsentType.ESSENTIAL), any(), any(Boolean.class), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "Essential consent cannot be changed"));

        String essentialBody = objectMapper.writeValueAsString(Map.of(
                "consentType", "ESSENTIAL",
                "version", "v1.0",
                "accepted", true));
        mockMvc.perform(post("/consents")
                .with(com.careerops.security.InternalRequestHeaders.hmac("POST", "/consents", essentialBody))
                .header("X-Internal-User-Id", INTERNAL_USER_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(essentialBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /consents missing accepted returns 400 validation")
    void postMissingAcceptedReturns400() throws Exception {
        String missingAcceptedBody = objectMapper.writeValueAsString(Map.of(
                "consentType", "MARKETING",
                "version", "v1.0"));
        mockMvc.perform(post("/consents")
                .with(com.careerops.security.InternalRequestHeaders.hmac("POST", "/consents", missingAcceptedBody))
                .header("X-Internal-User-Id", INTERNAL_USER_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(missingAcceptedBody))
                .andExpect(status().isBadRequest());
    }
}
