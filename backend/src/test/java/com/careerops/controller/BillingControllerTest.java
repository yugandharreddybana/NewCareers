package com.careerops.controller;

import com.careerops.dto.BillingDtos.SessionUrlResponse;
import com.careerops.dto.BillingDtos.SubscriptionResponse;
import com.careerops.dto.BillingDtos.UsageThisMonth;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.service.BillingService;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class BillingControllerTest {

    @Mock BillingService billingService;

    @InjectMocks BillingController controller;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UUID userId = UUID.randomUUID();

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
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
        authenticate(userId);
        when(billingService.getSubscriptionForUser(userId))
                .thenReturn(new SubscriptionResponse(
                        SubscriptionPlan.FREE,
                        SubscriptionStatus.TRIALING,
                        null,
                        null,
                        7,
                        new UsageThisMonth(0, 0)));

        mockMvc.perform(get("/billing/subscription"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.status").value("TRIALING"));

        verify(billingService).getSubscriptionForUser(userId);
    }

    @Test
    @DisplayName("POST /billing/checkout-session returns checkout URL")
    void checkoutSession() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
        authenticate(userId);
        when(billingService.createCheckoutSession(eq(userId), eq(SubscriptionPlan.PRO)))
                .thenReturn(new SessionUrlResponse("https://checkout.example/session"));

        mockMvc.perform(post("/billing/checkout-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plan":"PRO"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://checkout.example/session"));

        verify(billingService).createCheckoutSession(eq(userId), eq(SubscriptionPlan.PRO));
    }

    @Test
    @DisplayName("POST /billing/customer-portal returns portal URL")
    void customerPortal() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
        authenticate(userId);
        when(billingService.createCustomerPortalSession(userId))
                .thenReturn(new SessionUrlResponse("https://billing.stripe.com/portal"));

        mockMvc.perform(post("/billing/customer-portal")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://billing.stripe.com/portal"));
    }
}
