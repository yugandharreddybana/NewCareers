package com.careerops.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
@Profile("!prod")
public class StripeMockGateway implements StripeGateway {

    private static final Logger log = LoggerFactory.getLogger(StripeMockGateway.class);
    static final String MOCK_SIGNATURE = "mock";

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
    public Event constructWebhookEvent(String payload, String signatureHeader)
            throws SignatureVerificationException {
        log.debug("MOCK STRIPE: constructWebhookEvent");
        if (signatureHeader == null || signatureHeader.isBlank()) {
            throw new SignatureVerificationException("Missing stripe-signature header", signatureHeader);
        }
        if (!MOCK_SIGNATURE.equals(signatureHeader) && !signatureHeader.startsWith("mock_")) {
            throw new SignatureVerificationException("Invalid mock signature", signatureHeader);
        }
        return Event.GSON.fromJson(payload, Event.class);
    }
}
