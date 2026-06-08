package com.careerops.billing;

import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.Map;
import java.util.UUID;

@Component
@Profile("prod")
public class StripeRealGateway implements StripeGateway {

    private static final Logger log = LoggerFactory.getLogger(StripeRealGateway.class);

    private final StripeProperties properties;

    public StripeRealGateway(StripeProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void init() {
        Stripe.apiKey = properties.getSecretKey();
    }

    @Override
    public String createCustomer(String email, UUID organizationId) {
        try {
            com.stripe.model.Customer customer = com.stripe.model.Customer.create(
                    CustomerCreateParams.builder()
                            .setEmail(email)
                            .putMetadata("organizationId", organizationId.toString())
                            .build());
            return customer.getId();
        } catch (Exception e) {
            log.error("Stripe createCustomer failed orgId={}", organizationId, e);
            throw new IllegalStateException("Failed to create Stripe customer", e);
        }
    }

    @Override
    public CheckoutSessionResult createCheckoutSession(
            String customerId,
            String priceId,
            String successUrl,
            String cancelUrl,
            Map<String, String> metadata) {
        try {
            SessionCreateParams.Builder builder = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomer(customerId)
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setPrice(priceId)
                            .setQuantity(1L)
                            .build());
            metadata.forEach(builder::putMetadata);

            com.stripe.model.checkout.Session session =
                    com.stripe.model.checkout.Session.create(builder.build());
            return new CheckoutSessionResult(session.getUrl(), session.getId());
        } catch (Exception e) {
            log.error("Stripe createCheckoutSession failed customerId={}", customerId, e);
            throw new IllegalStateException("Failed to create Stripe checkout session", e);
        }
    }

    @Override
    public PortalSessionResult createCustomerPortalSession(String customerId, String returnUrl) {
        try {
            com.stripe.model.billingportal.Session portal =
                    com.stripe.model.billingportal.Session.create(
                    com.stripe.param.billingportal.SessionCreateParams.builder()
                            .setCustomer(customerId)
                            .setReturnUrl(returnUrl)
                            .build());
            return new PortalSessionResult(portal.getUrl());
        } catch (Exception e) {
            log.error("Stripe createCustomerPortalSession failed customerId={}", customerId, e);
            throw new IllegalStateException("Failed to create Stripe customer portal session", e);
        }
    }

    @Override
    public Event constructWebhookEvent(String payload, String signatureHeader)
            throws SignatureVerificationException {
        return Webhook.constructEvent(payload, signatureHeader, properties.getWebhookSecret());
    }
}
