package com.careerops.billing;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for prod {@link StripeRealGateway} webhook verification (BILL-TEST-003).
 * Does not call live Stripe APIs — only exercises {@code constructWebhookEvent}.
 */
class StripeRealGatewayTest {

    private static final String WEBHOOK_SECRET = "whsec_test_construct_event_secret";

    private StripeRealGateway gateway;

    @BeforeEach
    void setUp() {
        StripeProperties properties = new StripeProperties();
        properties.setSecretKey("sk_test_unit");
        properties.setWebhookSecret(WEBHOOK_SECRET);
        gateway = new StripeRealGateway(properties, new StripePlanMapper(properties));
        gateway.init();
    }

    @Test
    @DisplayName("constructWebhookEvent accepts Stripe test signature header")
    void constructWebhookEventValidSignature() throws Exception {
        String payload = """
                {"id":"evt_unit_test","object":"event","type":"ping"}
                """;
        String signature = Webhook.generateTestHeaderString(payload, WEBHOOK_SECRET);

        Event event = gateway.constructWebhookEvent(payload, signature);

        assertThat(event.getId()).isEqualTo("evt_unit_test");
    }

    @Test
    @DisplayName("constructWebhookEvent rejects invalid signature")
    void constructWebhookEventInvalidSignature() {
        String payload = "{\"id\":\"evt_bad\"}";

        assertThatThrownBy(() -> gateway.constructWebhookEvent(payload, "t=0,v1=invalid"))
                .isInstanceOf(SignatureVerificationException.class);
    }
}
