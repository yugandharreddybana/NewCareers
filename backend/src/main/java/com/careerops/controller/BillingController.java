package com.careerops.controller;

import com.careerops.dto.BillingDtos.CheckoutSessionRequest;
import com.careerops.dto.BillingDtos.SessionUrlResponse;
import com.careerops.dto.BillingDtos.SubscriptionResponse;
import com.careerops.service.BillingService;
import com.careerops.util.AuthUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping({"/billing", "/v1/billing"})
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping("/subscription")
    public SubscriptionResponse getSubscription() {
        UUID userId = AuthUtil.currentUserId();
        return billingService.getSubscriptionForUser(userId);
    }

    @PostMapping("/checkout-session")
    public SessionUrlResponse createCheckoutSession(@Valid @RequestBody CheckoutSessionRequest request) {
        UUID userId = AuthUtil.currentUserId();
        return billingService.createCheckoutSession(userId, request.plan());
    }

    @PostMapping("/customer-portal")
    public SessionUrlResponse createCustomerPortalSession() {
        UUID userId = AuthUtil.currentUserId();
        return billingService.createCustomerPortalSession(userId);
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(
            HttpServletRequest request,
            @RequestHeader(value = "Stripe-Signature", required = false) String stripeSignature)
            throws IOException {
        String payload = new String(request.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        billingService.handleWebhook(payload, stripeSignature);
        return ResponseEntity.ok().build();
    }
}
