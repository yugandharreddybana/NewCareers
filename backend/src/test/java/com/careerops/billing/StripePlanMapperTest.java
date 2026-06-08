package com.careerops.billing;

import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StripePlanMapperTest {

    private StripePlanMapper mapper;
    private StripeProperties properties;

    @BeforeEach
    void setUp() {
        properties = new StripeProperties();
        properties.getPriceId().setPro("price_pro_test");
        properties.getPriceId().setEnterprise("price_ent_test");
        mapper = new StripePlanMapper(properties);
    }

    @Test
    @DisplayName("priceIdForPlan maps PRO and ENTERPRISE")
    void priceIdForPlan() {
        assertThat(mapper.priceIdForPlan(SubscriptionPlan.PRO)).isEqualTo("price_pro_test");
        assertThat(mapper.priceIdForPlan(SubscriptionPlan.ENTERPRISE)).isEqualTo("price_ent_test");
        assertThatThrownBy(() -> mapper.priceIdForPlan(SubscriptionPlan.FREE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("resolvePlanForPriceId maps configured price ids")
    void resolvePlanForPriceId() {
        assertThat(mapper.resolvePlanForPriceId("price_pro_test")).contains(SubscriptionPlan.PRO);
        assertThat(mapper.resolvePlanForPriceId("price_ent_test")).contains(SubscriptionPlan.ENTERPRISE);
        assertThat(mapper.resolvePlanForPriceId("price_unknown")).isEmpty();
        assertThat(mapper.resolvePlanForPriceId(null)).isEmpty();
        assertThat(mapper.resolvePlanForPriceId("")).isEmpty();
    }

    @Test
    @DisplayName("mapStripeStatus covers active, trialing, past_due variants, and cancelled")
    void mapStripeStatus() {
        assertThat(mapper.mapStripeStatus("active")).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(mapper.mapStripeStatus("trialing")).isEqualTo(SubscriptionStatus.TRIALING);
        assertThat(mapper.mapStripeStatus("past_due")).isEqualTo(SubscriptionStatus.PAST_DUE);
        assertThat(mapper.mapStripeStatus("incomplete")).isEqualTo(SubscriptionStatus.PAST_DUE);
        assertThat(mapper.mapStripeStatus("paused")).isEqualTo(SubscriptionStatus.PAST_DUE);
        assertThat(mapper.mapStripeStatus("canceled")).isEqualTo(SubscriptionStatus.CANCELLED);
        assertThat(mapper.mapStripeStatus("unpaid")).isEqualTo(SubscriptionStatus.CANCELLED);
        assertThat(mapper.mapStripeStatus("incomplete_expired")).isEqualTo(SubscriptionStatus.CANCELLED);
        assertThat(mapper.mapStripeStatus(null)).isEqualTo(SubscriptionStatus.CANCELLED);
    }

    @Test
    @DisplayName("unknown Stripe status defaults to ACTIVE")
    void unknownStripeStatusDefaultsToActive() {
        assertThat(mapper.mapStripeStatus("weird_status")).isEqualTo(SubscriptionStatus.ACTIVE);
    }
}
