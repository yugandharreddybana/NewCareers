package com.careerops.controller;

import com.careerops.dto.BillingDtos.CancelSubscriptionResponse;
import com.careerops.dto.BillingDtos.CheckoutSessionRequest;
import com.careerops.dto.BillingDtos.InvoiceResponse;
import com.careerops.dto.BillingDtos.PlanResponse;
import com.careerops.dto.BillingDtos.SessionUrlResponse;
import com.careerops.dto.BillingDtos.SetBillingOrganizationRequest;
import com.careerops.dto.BillingDtos.SubscriptionResponse;
import com.careerops.dto.BillingDtos.UsageMetricsResponse;
import com.careerops.billing.WebhookDisposition;
import com.careerops.exception.ApiException;
import com.careerops.service.BillingService;
import com.careerops.util.AuthUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import java.util.List;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

@RestController
@RequestMapping({"/billing", "/v1/billing"})
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping({"/subscription", "", "/"})
    public SubscriptionResponse getSubscription() {
        UUID userId = AuthUtil.currentUserId();
        return billingService.getSubscriptionForUser(userId);
    }

    @GetMapping("/plans")
    public List<PlanResponse> getPlans() {
        return billingService.listPlans();
    }

    @GetMapping("/usage")
    public UsageMetricsResponse getUsage() {
        UUID userId = AuthUtil.currentUserId();
        return billingService.getUsageForUser(userId);
    }

    @PutMapping("/organization")
    public ResponseEntity<Void> setBillingOrganization(@Valid @RequestBody SetBillingOrganizationRequest request) {
        UUID userId = AuthUtil.currentUserId();
        billingService.setPrimaryBillingOrganization(userId, request.organizationId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/invoices")
    public List<InvoiceResponse> getInvoices() {
        UUID userId = AuthUtil.currentUserId();
        return billingService.getInvoicesForUser(userId);
    }

    @PostMapping({"/checkout-session", "/checkout"})
    public SessionUrlResponse createCheckoutSession(@Valid @RequestBody CheckoutSessionRequest request) {
        UUID userId = AuthUtil.currentUserId();
        return billingService.createCheckoutSession(userId, request.plan());
    }

    @PostMapping({"/customer-portal", "/portal"})
    public SessionUrlResponse createCustomerPortalSession() {
        UUID userId = AuthUtil.currentUserId();
        return billingService.createCustomerPortalSession(userId);
    }

    @PostMapping("/reactivate")
    public ResponseEntity<Void> reactivateSubscription() {
        throw new ApiException(HttpStatus.BAD_REQUEST,
                "Reactivate your subscription through the Stripe customer portal.");
    }

    @PostMapping("/cancel")
    public CancelSubscriptionResponse cancelSubscription() {
        UUID userId = AuthUtil.currentUserId();
        return billingService.cancelSubscription(userId);
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(
            HttpServletRequest request,
            @RequestHeader("Stripe-Signature") String stripeSignature)
            throws IOException {
        byte[] payload = readWebhookBody(request.getInputStream());
        WebhookDisposition disposition = billingService.handleWebhook(payload, stripeSignature);
        return ResponseEntity.ok()
                .header("X-Webhook-Disposition", disposition.name())
                .build();
    }

    private static byte[] readWebhookBody(InputStream inputStream) throws IOException {
        byte[] buffer = new byte[8192];
        int total = 0;
        byte[] payload = new byte[0];
        int read;
        while ((read = inputStream.read(buffer)) != -1) {
            total += read;
            if (total > 1_048_576) {
                throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Webhook payload too large");
            }
            byte[] next = new byte[total];
            System.arraycopy(payload, 0, next, 0, payload.length);
            System.arraycopy(buffer, 0, next, payload.length, read);
            payload = next;
        }
        return payload;
    }
}
