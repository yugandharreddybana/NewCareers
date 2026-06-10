package com.careerops.service;

import com.careerops.model.Subscription;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class BillingPeriodService {

    private static final long BILLING_PERIOD_DAYS = 30;

    public Instant resolvePeriodStart(Subscription subscription) {
        if (subscription.getCurrentPeriodStart() != null) {
            return subscription.getCurrentPeriodStart();
        }
        if (subscription.getCurrentPeriodEnd() != null) {
            return subscription.getCurrentPeriodEnd().minus(BILLING_PERIOD_DAYS, ChronoUnit.DAYS);
        }
        return subscription.getCreatedAt() != null
                ? subscription.getCreatedAt()
                : Instant.now();
    }

    public Instant resolvePeriodEnd(Subscription subscription) {
        if (subscription.getCurrentPeriodEnd() != null) {
            return subscription.getCurrentPeriodEnd();
        }
        return resolvePeriodStart(subscription).plus(BILLING_PERIOD_DAYS, ChronoUnit.DAYS);
    }

    public Instant nextResetInstant(Subscription subscription) {
        return resolvePeriodEnd(subscription);
    }
}
