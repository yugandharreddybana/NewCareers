package com.careerops.model;

/**
 * Canonical per-tier quota values for AI tokens and job delivery caps.
 */
public final class PlanTierLimits {

    private PlanTierLimits() {}

    public static long tokenBudget(PlanTier tier) {
        if (tier == null) {
            return 50_000L;
        }
        return switch (tier) {
            case FREE    -> 50_000L;
            case PRO     -> 200_000L;
            case PREMIUM -> 500_000L;
        };
    }

    public static int jobCap(PlanTier tier) {
        if (tier == null) {
            return 5;
        }
        return switch (tier) {
            case FREE    -> 5;
            case PRO     -> 15;
            case PREMIUM -> 25;
        };
    }
}
