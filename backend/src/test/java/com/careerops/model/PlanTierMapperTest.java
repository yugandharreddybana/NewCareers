package com.careerops.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PlanTierMapperTest {

    @Test
    void mapsSubscriptionPlansIncludingEnterpriseToPremium() {
        assertThat(PlanTierMapper.fromSubscription(null)).isEqualTo(PlanTier.FREE);
        assertThat(PlanTierMapper.fromSubscription(SubscriptionPlan.FREE)).isEqualTo(PlanTier.FREE);
        assertThat(PlanTierMapper.fromSubscription(SubscriptionPlan.PRO)).isEqualTo(PlanTier.PRO);
        assertThat(PlanTierMapper.fromSubscription(SubscriptionPlan.ENTERPRISE)).isEqualTo(PlanTier.PREMIUM);
    }
}
