package com.careerops.dto;

import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminSaasDtos {

    private AdminSaasDtos() {}

    public record SaasMetricsResponse(
            long totalUsers,
            long activeSubscriptions,
            BigDecimal mrr,
            double churnRatePercent,
            double trialConversionRatePercent,
            Instant asOf) {}

    public record SubscriptionRow(
            UUID orgId,
            String orgName,
            SubscriptionPlan plan,
            SubscriptionStatus status,
            Instant trialEndsAt,
            Instant currentPeriodEnd,
            String stripeCustomerId) {}

    public record PagedSubscriptionsResponse(
            List<SubscriptionRow> rows,
            long totalElements,
            int totalPages,
            int page,
            int size) {}

    public record OverridePlanRequest(
            @NotNull SubscriptionPlan plan,
            SubscriptionStatus status) {}

    public record FeatureFlagRow(
            UUID id,
            String flagKey,
            boolean enabled,
            String description,
            Instant updatedAt) {}

    public record AiUsageRow(
            UUID orgId,
            String orgName,
            long totalTokens,
            BigDecimal totalCostUsd,
            long requestCount) {}
}
