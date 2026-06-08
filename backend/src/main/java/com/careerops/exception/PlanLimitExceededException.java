package com.careerops.exception;

import com.careerops.model.SubscriptionPlan;

public class PlanLimitExceededException extends RuntimeException {

    private final String feature;
    private final SubscriptionPlan plan;
    private final String upgradeUrl;

    public PlanLimitExceededException(String feature, SubscriptionPlan plan, String upgradeUrl) {
        super("Plan limit exceeded for feature: " + feature);
        this.feature = feature;
        this.plan = plan;
        this.upgradeUrl = upgradeUrl;
    }

    public static PlanLimitExceededException of(String feature, SubscriptionPlan plan) {
        return new PlanLimitExceededException(feature, plan, "/pricing");
    }

    public String getFeature() {
        return feature;
    }

    public SubscriptionPlan getPlan() {
        return plan;
    }

    public String getUpgradeUrl() {
        return upgradeUrl;
    }
}
