package com.careerops.controller;

import com.careerops.billing.WebhookDisposition;
import com.careerops.dto.BillingDtos.PlanLimitsResponse;
import com.careerops.dto.BillingDtos.SessionUrlResponse;
import com.careerops.dto.BillingDtos.SubscriptionResponse;
import com.careerops.dto.BillingDtos.UsageThisMonth;
import com.careerops.exception.ApiException;
import com.careerops.exception.GlobalExceptionHandler;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.service.BillingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class BillingControllerTest {

    @Mock BillingService billingService;

    @InjectMocks BillingController controller;

    private final UUID userId = UUID.randomUUID();

    private MockMvc mockMvc() {
        return MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate(UUID userId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId.toString(), null));
    }

    @Test
    @DisplayName("GET /billing/subscription returns subscription snapshot")
    void getSubscription() throws Exception {
        authenticate(userId);
        when(billingService.getSubscriptionForUser(userId))
                .thenReturn(new SubscriptionResponse(
                        UUID.randomUUID(),
                        SubscriptionPlan.FREE,
                        SubscriptionPlan.PRO,
                        SubscriptionStatus.TRIALING,
                        null,
                        null,
                        7,
                        false,
                        true,
                        new UsageThisMonth(0, 0),
                        new PlanLimitsResponse(5, 10, 1, 1),
                        0L));

        mockMvc().perform(get("/billing/subscription"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.status").value("TRIALING"));

        verify(billingService).getSubscriptionForUser(userId);
    }

    @Test
    @DisplayName("POST /billing/checkout-session returns checkout URL")
    void checkoutSession() throws Exception {
        authenticate(userId);
        when(billingService.createCheckoutSession(eq(userId), eq(SubscriptionPlan.PRO)))
                .thenReturn(new SessionUrlResponse("https://checkout.example/session"));

        mockMvc().perform(post("/billing/checkout-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plan":"PRO"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://checkout.example/session"));

        verify(billingService).createCheckoutSession(eq(userId), eq(SubscriptionPlan.PRO));
    }

    @Test
    @DisplayName("POST /billing/cancel schedules cancellation")
    void cancelSubscription() throws Exception {
        authenticate(userId);
        when(billingService.cancelSubscription(userId))
                .thenReturn(new com.careerops.dto.BillingDtos.CancelSubscriptionResponse(
                        true,
                        java.time.Instant.parse("2026-07-15T00:00:00Z")));

        mockMvc().perform(post("/billing/cancel")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelAtPeriodEnd").value(true));

        verify(billingService).cancelSubscription(userId);
    }

    @Test
    @DisplayName("POST /billing/customer-portal returns portal URL")
    void customerPortal() throws Exception {
        authenticate(userId);
        when(billingService.createCustomerPortalSession(userId))
                .thenReturn(new SessionUrlResponse("https://billing.stripe.com/portal"));

        mockMvc().perform(post("/billing/customer-portal")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://billing.stripe.com/portal"));
    }

    @Test
    @DisplayName("POST /billing/checkout-session rejects FREE plan")
    void checkoutSessionRejectsFreePlan() throws Exception {
        authenticate(userId);

        mockMvc().perform(post("/billing/checkout-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plan":"FREE"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /billing/webhook returns disposition header on success")
    void webhookSuccess() throws Exception {
        when(billingService.handleWebhook(any(), eq("sig_test"))).thenReturn(WebhookDisposition.PROCESSED);

        mockMvc().perform(post("/billing/webhook")
                        .header("Stripe-Signature", "sig_test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"evt_1\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Webhook-Disposition", "PROCESSED"));
    }

    @Test
    @DisplayName("POST /billing/webhook requires Stripe-Signature header")
    void webhookMissingSignature() throws Exception {
        mockMvc().perform(post("/billing/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /billing/webhook rejects oversized payload")
    void webhookPayloadTooLarge() throws Exception {
        byte[] oversized = new byte[1_048_577];

        mockMvc().perform(post("/billing/webhook")
                        .header("Stripe-Signature", "sig_test")
                        .content(oversized))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    @DisplayName("POST /billing/webhook maps invalid signature to 400")
    void webhookInvalidSignature() throws Exception {
        doThrow(new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid Stripe signature"))
                .when(billingService).handleWebhook(any(), eq("bad_sig"));

        mockMvc().perform(post("/billing/webhook")
                        .header("Stripe-Signature", "bad_sig")
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
