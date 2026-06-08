package com.careerops.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;

import java.util.Map;
import java.util.UUID;

public interface StripeGateway {

    String createCustomer(String email, UUID organizationId);

    CheckoutSessionResult createCheckoutSession(
            String customerId,
            String priceId,
            String successUrl,
            String cancelUrl,
            Map<String, String> metadata);

    PortalSessionResult createCustomerPortalSession(String customerId, String returnUrl);

    Event constructWebhookEvent(String payload, String signatureHeader) throws SignatureVerificationException;
}
