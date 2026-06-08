package com.careerops.service;

import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;

import java.time.Instant;
import java.util.UUID;

public record SubscriptionContext(
        UUID orgId,
        UUID subscriptionId,
        SubscriptionPlan plan,
        SubscriptionStatus status,
        Instant trialEndsAt) {}
