package com.careerops.dto;

import com.careerops.model.PlanLimit;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class BillingDtos {

    private BillingDtos() {}

    public record CheckoutSessionRequest(@NotNull SubscriptionPlan plan) {
        @AssertTrue(message = "Checkout requires a paid plan (PRO or ENTERPRISE)")
        public boolean isPaidPlan() {
            return plan == SubscriptionPlan.PRO || plan == SubscriptionPlan.ENTERPRISE;
        }
    }

    public record SessionUrlResponse(String url) {}

    public record UsageThisMonth(long aiRuns, long applications) {}

    public record PlanLimitsResponse(
            int aiRunsPerMonth,
            int applicationsPerMonth,
            int cvUploads,
            int teamMembers) {

        public static PlanLimitsResponse from(PlanLimit limits) {
            return new PlanLimitsResponse(
                    toApiLimit(limits.aiSkillRunsPerMonth()),
                    toApiLimit(limits.jobApplicationsPerMonth()),
                    toApiLimit(limits.cvUploads()),
                    toApiLimit(limits.teamMembers()));
        }

        private static int toApiLimit(int limit) {
            return PlanLimit.UNLIMITED == limit ? -1 : limit;
        }
    }

    public record SubscriptionResponse(
            UUID organizationId,
            SubscriptionPlan plan,
            SubscriptionPlan effectivePlan,
            SubscriptionStatus status,
            Instant trialEndsAt,
            Instant currentPeriodEnd,
            boolean cancelAtPeriodEnd,
            int daysRemaining,
            boolean hasBillingAccount,
            boolean canManageBilling,
            UsageThisMonth usageThisMonth,
            PlanLimitsResponse limits,
            long cvUploadsTotal) {}

    public record PlanResponse(
            String id,
            String name,
            java.math.BigDecimal price,
            String currency,
            String interval,
            List<String> features) {}

    public record UsageMetricsResponse(
            long skillsUsed,
            int skillsLimit,
            long jobsScanned,
            int jobsLimit,
            Instant resetDate) {}

    public record SetBillingOrganizationRequest(@NotNull UUID organizationId) {}

    public record CancelSubscriptionResponse(boolean cancelAtPeriodEnd, Instant currentPeriodEnd) {}

    public record InvoiceResponse(
            String id,
            long amount,
            String currency,
            String status,
            Instant date,
            String pdfUrl) {}
}
