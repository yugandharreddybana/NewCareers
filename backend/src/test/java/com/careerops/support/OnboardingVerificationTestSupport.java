package com.careerops.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Completes onboarding email verification for integration tests (@careerops.test + dev OTP).
 */
public final class OnboardingVerificationTestSupport {

    private OnboardingVerificationTestSupport() {}

    public static UUID verifyEmailForTest(MockMvc mockMvc, ObjectMapper objectMapper, String email)
            throws Exception {
        mockMvc.perform(
                post("/auth/onboarding/send-verification-otp")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of(
                            "email", email,
                            "firstName", "Test"))))
            .andExpect(status().isAccepted());

        MvcResult verify = mockMvc.perform(
                post("/auth/onboarding/verify-email")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of(
                            "email", email,
                            "otp", "00000000",
                            "captchaToken", ""))))
            .andExpect(status().isOk())
            .andReturn();

        Map<?, ?> body = objectMapper.readValue(verify.getResponse().getContentAsString(), Map.class);
        return UUID.fromString((String) body.get("verificationId"));
    }

    public static Map<String, Object> defaultSignupConsents() {
        return Map.of(
                "termsAccepted", true,
                "aiProcessingAccepted", true,
                "marketingAccepted", false,
                "analyticsAccepted", false);
    }
}
