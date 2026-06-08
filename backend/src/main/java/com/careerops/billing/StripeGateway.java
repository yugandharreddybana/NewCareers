package com.careerops.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;

import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    void cancelSubscriptionAtPeriodEnd(String stripeSubscriptionId);

    void cancelSubscriptionImmediately(String stripeSubscriptionId);

    void deleteCustomer(String stripeCustomerId);

    List<StripeInvoiceRecord> listInvoices(String stripeCustomerId);

    Optional<Long> retrieveSubscriptionCurrentPeriodEnd(String stripeSubscriptionId);

    Optional<SubscriptionPlanResolution> resolveSubscriptionPlan(String stripeSubscriptionId);

    Event constructWebhookEvent(String payload, String signatureHeader) throws SignatureVerificationException;
}
