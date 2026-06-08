package com.careerops.model;

public record PlanLimit(
        int aiSkillRunsPerMonth,
        int jobApplicationsPerMonth,
        int cvUploads,
        int teamMembers) {

    public static final int UNLIMITED = Integer.MAX_VALUE;

    public static PlanLimit free() {
        return new PlanLimit(5, 10, 1, 1);
    }

    public static PlanLimit pro() {
        return new PlanLimit(200, UNLIMITED, 10, 5);
    }

    public static PlanLimit enterprise() {
        return new PlanLimit(UNLIMITED, UNLIMITED, UNLIMITED, UNLIMITED);
    }

    public static PlanLimit forPlan(SubscriptionPlan plan) {
        return switch (plan) {
            case FREE -> free();
            case PRO -> pro();
            case ENTERPRISE -> enterprise();
        };
    }

    public boolean isUnlimited(int limit) {
        return limit == UNLIMITED;
    }
}
