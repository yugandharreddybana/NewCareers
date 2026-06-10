package com.careerops.billing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class StripeMockGatewayTest {

    private StripeMockGateway gateway;

    @BeforeEach
    void setUp() {
        gateway = new StripeMockGateway(new StripeProperties());
    }

    @Test
    @DisplayName("createCustomer returns deterministic mock customer id")
    void createCustomerMockId() {
        UUID orgId = UUID.fromString("12345678-1234-1234-1234-123456789abc");

        String customerId = gateway.createCustomer("user@example.com", orgId);

        assertThat(customerId).isEqualTo("cus_mock_12345678");
    }

    @Test
    @DisplayName("createCheckoutSession returns success URL with mock session params")
    void createCheckoutSessionMockUrl() {
        UUID orgId = UUID.randomUUID();

        CheckoutSessionResult result = gateway.createCheckoutSession(
                "cus_mock_test",
                "price_pro_test",
                "http://localhost:4000/billing/success",
                "http://localhost:4000/billing/cancel",
                Map.of(
                        "organizationId", orgId.toString(),
                        "plan", "PRO"));

        assertThat(result.url()).startsWith("http://localhost:4000/billing/success");
        assertThat(result.url()).contains("mock_session=cs_mock_");
        assertThat(result.url()).contains("org_id=" + orgId);
        assertThat(result.url()).contains("plan=PRO");
        assertThat(result.sessionId()).startsWith("cs_mock_");
    }

    @Test
    @DisplayName("createCustomerPortalSession appends mock portal query param")
    void createCustomerPortalSessionMockUrl() {
        PortalSessionResult result = gateway.createCustomerPortalSession(
                "cus_mock_test",
                "http://localhost:4000/billing");

        assertThat(result.url()).startsWith("http://localhost:4000/billing");
        assertThat(result.url()).contains("mock_portal=bps_mock_");
    }
}
