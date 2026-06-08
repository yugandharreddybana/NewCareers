package com.careerops.dto;

import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public final class BillingDtos {

    private BillingDtos() {}

    public record CheckoutSessionRequest(@NotNull SubscriptionPlan plan) {}

    public record SessionUrlResponse(String url) {}

    public record UsageThisMonth(long aiRuns, long applications) {}

    public record SubscriptionResponse(
            SubscriptionPlan plan,
            SubscriptionStatus status,
            Instant trialEndsAt,
            Instant currentPeriodEnd,
            int daysRemaining,
            UsageThisMonth usageThisMonth) {}
}
