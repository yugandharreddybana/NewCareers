package com.careerops.billing;

import com.careerops.model.SubscriptionPlan;

public record SubscriptionPlanResolution(SubscriptionPlan plan, Long currentPeriodEndEpoch) {}
