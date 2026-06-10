package com.careerops.service;

import com.careerops.exception.PlanLimitExceededException;
import com.careerops.config.SaasBillingProperties;
import com.careerops.model.Organization;
import com.careerops.model.PlanLimit;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class PlanEnforcementService {

    private final Environment environment;
    private final SaasBillingProperties saasBillingProperties;
    private final OrganizationSubscriptionResolver resolver;
    private final SubscriptionRepository subscriptionRepository;
    private final OrgRepository orgRepository;
    private final OrgUsageCounter usageCounter;
    private final BillingPeriodService billingPeriodService;
    private final SaasLifecycleTelemetry lifecycleTelemetry;
    private final OrganizationPlanSyncService organizationPlanSyncService;
    private final UserQuotaGrantService quotaGrantService;

    public PlanEnforcementService(
            Environment environment,
            SaasBillingProperties saasBillingProperties,
            OrganizationSubscriptionResolver resolver,
            SubscriptionRepository subscriptionRepository,
            OrgRepository orgRepository,
            OrgUsageCounter usageCounter,
            BillingPeriodService billingPeriodService,
            SaasLifecycleTelemetry lifecycleTelemetry,
            OrganizationPlanSyncService organizationPlanSyncService,
            UserQuotaGrantService quotaGrantService) {
        this.environment = environment;
        this.saasBillingProperties = saasBillingProperties;
        this.resolver = resolver;
        this.subscriptionRepository = subscriptionRepository;
        this.orgRepository = orgRepository;
        this.usageCounter = usageCounter;
        this.billingPeriodService = billingPeriodService;
        this.lifecycleTelemetry = lifecycleTelemetry;
        this.organizationPlanSyncService = organizationPlanSyncService;
        this.quotaGrantService = quotaGrantService;
    }

    @Transactional
    public void checkAiRunAllowed(UUID userId) {
        checkAiRunAllowed(userId, 1);
    }

    @Transactional
    public void checkAiRunAllowed(UUID userId, int cost) {
        if (!enforcementEnabled()) {
            return;
        }
        if (bypassPlanLimits(userId)) {
            return;
        }
        SubscriptionContext ctx = lockContextForUser(userId);
        assertSubscriptionActive(ctx, userId);
        SubscriptionPlan plan = effectivePlan(ctx);
        PlanLimit limits = PlanLimit.forPlan(plan);
        if (limits.isUnlimited(limits.aiSkillRunsPerMonth())) {
            return;
        }
        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> new IllegalStateException("Subscription missing for org " + ctx.orgId()));
        Instant periodStart = billingPeriodService.resolvePeriodStart(subscription);
        long used = usageCounter.aiSkillRunsSince(ctx.orgId(), periodStart);
        if (used + cost > limits.aiSkillRunsPerMonth()) {
            lifecycleTelemetry.trackLimitHit(userId, "ai_skill_run");
            throw PlanLimitExceededException.of("ai_skill_run", plan);
        }
    }

    @Transactional
    public void checkApplicationAllowed(UUID userId) {
        if (!enforcementEnabled()) {
            return;
        }
        if (bypassPlanLimits(userId)) {
            return;
        }
        SubscriptionContext ctx = lockContextForUser(userId);
        assertSubscriptionActive(ctx, userId);
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

    @Transactional
    public void checkCvUploadAllowed(UUID userId) {
        if (!enforcementEnabled()) {
            return;
        }
        if (bypassPlanLimits(userId)) {
            return;
        }
        SubscriptionContext ctx = lockContextForUser(userId);
        assertSubscriptionActive(ctx, userId);
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

    @Transactional
    public void checkTeamMemberAllowed(UUID userId) {
        checkTeamMemberAllowed(userId, 0);
    }

    @Transactional
    public void checkTeamMemberAllowed(UUID userId, int pendingInvitations) {
        if (!enforcementEnabled()) {
            return;
        }
        if (bypassPlanLimits(userId)) {
            return;
        }
        SubscriptionContext ctx = lockContextForUser(userId);
        assertTeamMemberCapacity(ctx, userId, pendingInvitations);
    }

    @Transactional
    public void checkTeamMemberAllowedForOrg(UUID orgId, UUID actorUserId, int pendingInvitations) {
        if (!enforcementEnabled()) {
            return;
        }
        if (bypassPlanLimits(actorUserId)) {
            return;
        }
        SubscriptionContext ctx = lockContextForOrg(orgId);
        assertTeamMemberCapacity(ctx, actorUserId, pendingInvitations);
    }

    private void assertTeamMemberCapacity(SubscriptionContext ctx, UUID actorUserId, int pendingInvitations) {
        assertSubscriptionActive(ctx, actorUserId);
        SubscriptionPlan plan = effectivePlan(ctx);
        PlanLimit limits = PlanLimit.forPlan(plan);
        int effectiveCap = effectiveTeamMemberCap(limits, resolveOrgSeatLimit(ctx.orgId()));
        if (effectiveCap == Integer.MAX_VALUE) {
            return;
        }
        int used = usageCounter.teamMembers(ctx.orgId()) + pendingInvitations;
        if (used + 1 > effectiveCap) {
            lifecycleTelemetry.trackLimitHit(actorUserId, "team_member");
            throw PlanLimitExceededException.of("team_member", plan);
        }
    }

    private int resolveOrgSeatLimit(UUID orgId) {
        return orgRepository.findById(orgId).map(Organization::getSeatLimit).orElse(0);
    }

    static int effectiveTeamMemberCap(PlanLimit limits, int orgSeatLimit) {
        if (limits.isUnlimited(limits.teamMembers())) {
            return orgSeatLimit > 0 ? orgSeatLimit : Integer.MAX_VALUE;
        }
        int planCap = limits.teamMembers();
        if (orgSeatLimit <= 0) {
            return planCap;
        }
        return Math.min(orgSeatLimit, planCap);
    }

    public static SubscriptionPlan effectivePlan(SubscriptionContext ctx) {
        return ctx.plan();
    }

    private SubscriptionContext lockContextForUser(UUID userId) {
        SubscriptionContext ctx = resolver.resolveForUser(userId);
        lockOrg(ctx.orgId());
        return ctx;
    }

    private SubscriptionContext lockContextForOrg(UUID orgId) {
        Subscription subscription = lockOrg(orgId);
        return new SubscriptionContext(
                orgId,
                subscription.getId(),
                subscription.getPlan(),
                subscription.getStatus(),
                subscription.getTrialEndsAt());
    }

    private Subscription lockOrg(UUID orgId) {
        return subscriptionRepository.findByOrganizationIdForUpdate(orgId)
                .orElseThrow(() -> new IllegalStateException("Subscription missing for org " + orgId));
    }

    private void assertSubscriptionActive(SubscriptionContext ctx, UUID userId) {
        if (bypassPlanLimits(userId)) {
            return;
        }
        SubscriptionPlan plan = effectivePlan(ctx);
        if (ctx.status() == SubscriptionStatus.PAST_DUE || ctx.status() == SubscriptionStatus.CANCELLED) {
            lifecycleTelemetry.findOrgOwnerUserId(ctx.orgId())
                    .ifPresent(ownerUserId -> lifecycleTelemetry.trackLimitHit(ownerUserId, "subscription_inactive"));
            throw PlanLimitExceededException.of("subscription_inactive", plan);
        }
    }

    boolean enforcementEnabled() {
        return saasBillingProperties.isEnforcementEnabled();
    }

    private boolean bypassPlanLimits(UUID userId) {
        return quotaGrantService.unlimitedAccess(userId);
    }
}
