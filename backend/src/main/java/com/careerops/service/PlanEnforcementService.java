package com.careerops.service;

import com.careerops.exception.PlanLimitExceededException;
import com.careerops.model.PlanLimit;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class PlanEnforcementService {

    private final Environment environment;
    private final OrganizationSubscriptionResolver resolver;
    private final OrgUsageCounter usageCounter;
    private final SaasLifecycleTelemetry lifecycleTelemetry;

    public PlanEnforcementService(
            Environment environment,
            OrganizationSubscriptionResolver resolver,
            OrgUsageCounter usageCounter,
            SaasLifecycleTelemetry lifecycleTelemetry) {
        this.environment = environment;
        this.resolver = resolver;
        this.usageCounter = usageCounter;
        this.lifecycleTelemetry = lifecycleTelemetry;
    }

    public void checkAiRunAllowed(UUID userId) {
        checkAiRunAllowed(userId, 1);
    }

    public void checkAiRunAllowed(UUID userId, int cost) {
        if (!enforcementEnabled()) {
            return;
        }
        SubscriptionContext ctx = resolver.resolveForUser(userId);
        assertSubscriptionActive(ctx);
        SubscriptionPlan plan = effectivePlan(ctx);
        PlanLimit limits = PlanLimit.forPlan(plan);
        if (limits.isUnlimited(limits.aiSkillRunsPerMonth())) {
            return;
        }
        long used = usageCounter.aiSkillRunsThisMonth(ctx.orgId());
        if (used + cost > limits.aiSkillRunsPerMonth()) {
            lifecycleTelemetry.trackLimitHit(userId, "ai_skill_run");
            throw PlanLimitExceededException.of("ai_skill_run", plan);
        }
    }

    public void checkApplicationAllowed(UUID userId) {
        if (!enforcementEnabled()) {
            return;
        }
        SubscriptionContext ctx = resolver.resolveForUser(userId);
        assertSubscriptionActive(ctx);
        SubscriptionPlan plan = effectivePlan(ctx);
        PlanLimit limits = PlanLimit.forPlan(plan);
        if (limits.isUnlimited(limits.jobApplicationsPerMonth())) {
            return;
        }
        long used = usageCounter.jobApplicationsThisMonth(ctx.orgId());
        if (used + 1 > limits.jobApplicationsPerMonth()) {
            lifecycleTelemetry.trackLimitHit(userId, "job_application");
            throw PlanLimitExceededException.of("job_application", plan);
        }
    }

    public void checkCvUploadAllowed(UUID userId) {
        if (!enforcementEnabled()) {
            return;
        }
        SubscriptionContext ctx = resolver.resolveForUser(userId);
        assertSubscriptionActive(ctx);
        SubscriptionPlan plan = effectivePlan(ctx);
        PlanLimit limits = PlanLimit.forPlan(plan);
        if (limits.isUnlimited(limits.cvUploads())) {
            return;
        }
        long used = usageCounter.cvUploadsTotal(ctx.orgId());
        if (used + 1 > limits.cvUploads()) {
            lifecycleTelemetry.trackLimitHit(userId, "cv_upload");
            throw PlanLimitExceededException.of("cv_upload", plan);
        }
    }

    public void checkTeamMemberAllowed(UUID userId) {
        if (!enforcementEnabled()) {
            return;
        }
        SubscriptionContext ctx = resolver.resolveForUser(userId);
        assertSubscriptionActive(ctx);
        SubscriptionPlan plan = effectivePlan(ctx);
        PlanLimit limits = PlanLimit.forPlan(plan);
        if (limits.isUnlimited(limits.teamMembers())) {
            return;
        }
        int used = usageCounter.teamMembers(ctx.orgId());
        if (used + 1 > limits.teamMembers()) {
            lifecycleTelemetry.trackLimitHit(userId, "team_member");
            throw PlanLimitExceededException.of("team_member", plan);
        }
    }

    static SubscriptionPlan effectivePlan(SubscriptionContext ctx) {
        if (ctx.status() == SubscriptionStatus.TRIALING
                && ctx.trialEndsAt() != null
                && ctx.trialEndsAt().isAfter(Instant.now())) {
            return SubscriptionPlan.PRO;
        }
        return ctx.plan();
    }

    private void assertSubscriptionActive(SubscriptionContext ctx) {
        SubscriptionPlan plan = effectivePlan(ctx);
        if (ctx.status() == SubscriptionStatus.PAST_DUE || ctx.status() == SubscriptionStatus.CANCELLED) {
            lifecycleTelemetry.findOrgOwnerUserId(ctx.orgId())
                    .ifPresent(userId -> lifecycleTelemetry.trackLimitHit(userId, "subscription_inactive"));
            throw PlanLimitExceededException.of("subscription_inactive", plan);
        }
        if (ctx.status() == SubscriptionStatus.TRIALING
                && ctx.trialEndsAt() != null
                && ctx.trialEndsAt().isBefore(Instant.now())) {
            lifecycleTelemetry.findOrgOwnerUserId(ctx.orgId())
                    .ifPresent(userId -> lifecycleTelemetry.trackLimitHit(userId, "trial_expired"));
            throw PlanLimitExceededException.of("trial_expired", plan);
        }
    }

    boolean enforcementEnabled() {
        return !environment.acceptsProfiles(Profiles.of("dev", "test"));
    }
}
