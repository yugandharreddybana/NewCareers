package com.careerops.model;

/**
 * Maps org-level {@link SubscriptionPlan} to user-scoped {@link PlanTier} for quotas.
 */
public final class PlanTierMapper {

    private PlanTierMapper() {}

    public static PlanTier fromSubscription(SubscriptionPlan plan) {
        if (plan == null) {
            return PlanTier.FREE;
        }
        return switch (plan) {
            case FREE -> PlanTier.FREE;
            case PRO -> PlanTier.PRO;
            case ENTERPRISE -> PlanTier.PREMIUM;
        };
    }
}
