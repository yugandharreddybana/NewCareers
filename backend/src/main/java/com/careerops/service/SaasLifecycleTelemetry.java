package com.careerops.service;

import com.careerops.model.OrgMember;
import com.careerops.model.SubscriptionPlan;
import com.careerops.repository.OrgMemberRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class SaasLifecycleTelemetry {

    public static final String TRIAL_STARTED = "trial_started";
    public static final String TRIAL_ENDED = "trial_ended";
    public static final String PLAN_UPGRADE = "plan_upgrade";
    public static final String PLAN_DOWNGRADE = "plan_downgrade";
    public static final String LIMIT_HIT = "limit_hit";

    private final AnalyticsService analyticsService;
    private final OrgMemberRepository orgMemberRepository;

    public SaasLifecycleTelemetry(AnalyticsService analyticsService, OrgMemberRepository orgMemberRepository) {
        this.analyticsService = analyticsService;
        this.orgMemberRepository = orgMemberRepository;
    }

    public void trackTrialStarted(UUID userId, UUID orgId, Instant trialEndsAt) {
        analyticsService.trackEvent(userId, TRIAL_STARTED, Map.of(
                "orgId", orgId.toString(),
                "trialEndsAt", trialEndsAt.toString()));
    }

    public void trackTrialEnded(UUID userId, UUID orgId) {
        analyticsService.trackEvent(userId, TRIAL_ENDED, Map.of(
                "orgId", orgId.toString(),
                "previousStatus", "TRIALING"));
    }

    public void trackPlanChange(UUID userId, SubscriptionPlan fromPlan, SubscriptionPlan toPlan) {
        if (planRank(toPlan) > planRank(fromPlan)) {
            analyticsService.trackEvent(userId, PLAN_UPGRADE, Map.of(
                    "fromPlan", fromPlan.name(),
                    "toPlan", toPlan.name()));
        } else if (planRank(toPlan) < planRank(fromPlan)) {
            analyticsService.trackEvent(userId, PLAN_DOWNGRADE, Map.of(
                    "fromPlan", fromPlan.name(),
                    "toPlan", toPlan.name()));
        }
    }

    public void trackLimitHit(UUID userId, String feature) {
        analyticsService.trackEvent(userId, LIMIT_HIT, Map.of("feature", feature));
    }

    public Optional<UUID> findOrgOwnerUserId(UUID orgId) {
        return orgMemberRepository.findByOrgId(orgId).stream()
                .filter(m -> "owner".equals(m.getRole()))
                .map(OrgMember::getUserId)
                .findFirst();
    }

    private static int planRank(SubscriptionPlan plan) {
        return switch (plan) {
            case FREE -> 0;
            case PRO -> 1;
            case ENTERPRISE -> 2;
        };
    }
}
