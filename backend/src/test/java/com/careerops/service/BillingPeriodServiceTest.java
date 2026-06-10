package com.careerops.service;

import com.careerops.model.Subscription;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class BillingPeriodServiceTest {

    private BillingPeriodService billingPeriodService;

    @BeforeEach
    void setUp() {
        billingPeriodService = new BillingPeriodService();
    }

    @Test
    void resolvePeriodStart_usesStoredPeriodStart() {
        Subscription subscription = new Subscription();
        Instant start = Instant.parse("2026-05-01T00:00:00Z");
        subscription.setCurrentPeriodStart(start);
        subscription.setCurrentPeriodEnd(start.plus(30, ChronoUnit.DAYS));

        assertThat(billingPeriodService.resolvePeriodStart(subscription)).isEqualTo(start);
    }

    @Test
    void resolvePeriodStart_derivesFromPeriodEndWhenStartMissing() {
        Subscription subscription = new Subscription();
        Instant end = Instant.parse("2026-06-01T00:00:00Z");
        subscription.setCurrentPeriodEnd(end);

        assertThat(billingPeriodService.resolvePeriodStart(subscription))
                .isEqualTo(end.minus(30, ChronoUnit.DAYS));
    }

    @Test
    void resolvePeriodStart_fallsBackToCreatedAtForFreeUsers() {
        Subscription subscription = new Subscription();
        Instant created = Instant.parse("2026-01-15T12:00:00Z");
        subscription.setCreatedAt(created);

        assertThat(billingPeriodService.resolvePeriodStart(subscription)).isEqualTo(created);
    }

    @Test
    void nextResetInstant_matchesPeriodEnd() {
        Subscription subscription = new Subscription();
        Instant end = Instant.parse("2026-07-01T00:00:00Z");
        subscription.setCurrentPeriodEnd(end);

        assertThat(billingPeriodService.nextResetInstant(subscription)).isEqualTo(end);
    }
}
