package com.careerops.billing;

import com.careerops.model.SubscriptionPlan;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
@Profile("!prod")
public class StripeMockGateway implements StripeGateway {

    private static final Logger log = LoggerFactory.getLogger(StripeMockGateway.class);

    private final StripeProperties properties;

    public StripeMockGateway(StripeProperties properties) {
        this.properties = properties;
    }

    @Override
    public String createCustomer(String email, UUID organizationId) {
        log.debug("MOCK STRIPE: createCustomer orgId={} email={}", organizationId, email);
        return "cus_mock_" + organizationId.toString().substring(0, 8);
    }

    @Override
    public CheckoutSessionResult createCheckoutSession(
            String customerId,
            String priceId,
            String successUrl,
            String cancelUrl,
            Map<String, String> metadata) {
        log.debug("MOCK STRIPE: createCheckoutSession customerId={} priceId={}", customerId, priceId);
        String plan = metadata.getOrDefault("plan", "PRO");
        String orgId = metadata.getOrDefault("organizationId", "");
        String sessionId = "cs_mock_" + UUID.randomUUID();
        String separator = successUrl.contains("?") ? "&" : "?";
        String url = successUrl + separator
                + "mock_session=" + sessionId
                + "&org_id=" + orgId
                + "&plan=" + plan;
        return new CheckoutSessionResult(url, sessionId);
    }

    @Override
    public PortalSessionResult createCustomerPortalSession(String customerId, String returnUrl) {
        log.debug("MOCK STRIPE: createCustomerPortalSession customerId={}", customerId);
        String portalId = "bps_mock_" + UUID.randomUUID();
        String separator = returnUrl.contains("?") ? "&" : "?";
        return new PortalSessionResult(returnUrl + separator + "mock_portal=" + portalId);
    }

    @Override
    public void cancelSubscriptionAtPeriodEnd(String stripeSubscriptionId) {
        log.debug("MOCK STRIPE: cancelSubscriptionAtPeriodEnd subId={}", stripeSubscriptionId);
    }

    @Override
    public void cancelSubscriptionImmediately(String stripeSubscriptionId) {
        log.debug("MOCK STRIPE: cancelSubscriptionImmediately subId={}", stripeSubscriptionId);
    }

    @Override
    public void deleteCustomer(String stripeCustomerId) {
        log.debug("MOCK STRIPE: deleteCustomer customerId={}", stripeCustomerId);
    }

    @Override
    public List<StripeInvoiceRecord> listInvoices(String stripeCustomerId) {
        if (stripeCustomerId == null || stripeCustomerId.isBlank()) {
            return List.of();
        }
        return List.of(new StripeInvoiceRecord(
                "in_mock_" + UUID.randomUUID().toString().substring(0, 8),
                2900L,
                "usd",
                "paid",
                Instant.now().minus(5, ChronoUnit.DAYS),
                null));
    }

    @Override
    public Optional<Long> retrieveSubscriptionCurrentPeriodEnd(String stripeSubscriptionId) {
        if (stripeSubscriptionId == null || stripeSubscriptionId.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(Instant.now().plus(30, ChronoUnit.DAYS).getEpochSecond());
    }

    @Override
    public Optional<SubscriptionPlanResolution> resolveSubscriptionPlan(String stripeSubscriptionId) {
        if (stripeSubscriptionId == null || stripeSubscriptionId.isBlank()) {
            return Optional.empty();
        }
        long periodEnd = Instant.now().plus(30, ChronoUnit.DAYS).getEpochSecond();
        return Optional.of(new SubscriptionPlanResolution(SubscriptionPlan.PRO, periodEnd));
    }

    @Override
    public Event constructWebhookEvent(String payload, String signatureHeader)
            throws SignatureVerificationException {
        log.debug("MOCK STRIPE: constructWebhookEvent");
        if (signatureHeader == null || signatureHeader.isBlank()) {
            throw new SignatureVerificationException("Missing stripe-signature header", signatureHeader);
        }
        String secret = properties.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            throw new SignatureVerificationException("Mock webhook secret not configured", signatureHeader);
        }
        if (!StripeMockWebhookSigner.verify(payload, signatureHeader, secret)) {
            throw new SignatureVerificationException("Invalid mock webhook HMAC signature", signatureHeader);
        }
        return Event.GSON.fromJson(payload, Event.class);
    }
}
