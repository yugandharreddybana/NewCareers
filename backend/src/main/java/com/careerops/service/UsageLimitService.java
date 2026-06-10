package com.careerops.service;

import com.careerops.dto.UsageDtos.DailyQuota;
import com.careerops.dto.UsageDtos.PeriodQuota;
import com.careerops.dto.UsageDtos.RateLimitHint;
import com.careerops.dto.UsageDtos.UsageLimitsResponse;
import com.careerops.model.PlanLimit;
import com.careerops.model.PlanTier;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.repository.SubscriptionRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
public class UsageLimitService {

    public static final ZoneId QUOTA_ZONE = ZoneId.of("Europe/Dublin");
    private static final DateTimeFormatter RESET_FORMAT =
            DateTimeFormatter.ofPattern("d MMM yyyy HH:mm").withZone(QUOTA_ZONE);

    private final DailyLimitService dailyLimitService;
    private final TokenUsageService tokenUsageService;
    private final UserPlanTierService planTierService;
    private final OrganizationSubscriptionResolver subscriptionResolver;
    private final SubscriptionRepository subscriptionRepository;
    private final OrgUsageCounter orgUsageCounter;
    private final BillingPeriodService billingPeriodService;
    private final UserQuotaGrantService quotaGrantService;

    public UsageLimitService(
            DailyLimitService dailyLimitService,
            TokenUsageService tokenUsageService,
            UserPlanTierService planTierService,
            OrganizationSubscriptionResolver subscriptionResolver,
            SubscriptionRepository subscriptionRepository,
            OrgUsageCounter orgUsageCounter,
            BillingPeriodService billingPeriodService,
            UserQuotaGrantService quotaGrantService) {
        this.dailyLimitService = dailyLimitService;
        this.tokenUsageService = tokenUsageService;
        this.planTierService = planTierService;
        this.subscriptionResolver = subscriptionResolver;
        this.subscriptionRepository = subscriptionRepository;
        this.orgUsageCounter = orgUsageCounter;
        this.billingPeriodService = billingPeriodService;
        this.quotaGrantService = quotaGrantService;
    }

    public UsageLimitsResponse snapshot(UUID userId) {
        PlanTier tier = planTierService.resolveForUser(userId);
        boolean unlimited = quotaGrantService.unlimitedAccess(userId);
        int jobUsed = dailyLimitService.getCount(userId);
        long jobLimit = unlimited ? -1L : dailyLimitService.maxForUser(userId);
        long jobRemaining = unlimited ? -1L : dailyLimitService.remaining(userId);

        long tokenBudget = unlimited ? -1L : quotaGrantService.tokenBudget(userId, tier);
        long aiUsed = tokenUsageService.tokensUsedSinceStartOfQuotaDay(userId);
        long aiRemaining = unlimited ? -1L : Math.max(0, tokenBudget - aiUsed);

        Instant dailyResetsAt = nextMidnightInstant();

        DailyQuota jobs = new DailyQuota(
                "job_delivery",
                "Jobs Left",
                jobUsed,
                jobLimit,
                jobRemaining,
                dailyResetsAt.toString(),
                "Resets at midnight (" + QUOTA_ZONE.getId() + ")"
        );

        DailyQuota ai = new DailyQuota(
                "ai_tokens",
                "AI Tokens",
                aiUsed,
                tokenBudget,
                aiRemaining,
                dailyResetsAt.toString(),
                "Resets at midnight (" + QUOTA_ZONE.getId() + ")"
        );

        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> new IllegalStateException("Subscription missing for org " + ctx.orgId()));
        SubscriptionPlan effectivePlan = PlanEnforcementService.effectivePlan(ctx);
        PlanLimit planLimits = PlanLimit.forPlan(effectivePlan);

        Instant periodStart = billingPeriodService.resolvePeriodStart(subscription);
        Instant periodEnd = billingPeriodService.nextResetInstant(subscription);
        long skillsUsed = orgUsageCounter.aiSkillRunsSince(ctx.orgId(), periodStart);
        boolean skillsUnlimited = unlimited
                || quotaGrantService.unlimitedSkills(userId)
                || planLimits.isUnlimited(planLimits.aiSkillRunsPerMonth());
        int skillsLimitRaw = planLimits.aiSkillRunsPerMonth();
        long skillsLimit = skillsUnlimited ? -1L : skillsLimitRaw;
        long skillsRemaining = skillsUnlimited
                ? -1L
                : Math.max(0, skillsLimitRaw - skillsUsed);

        PeriodQuota skillRuns = new PeriodQuota(
                "skill_runs",
                "Skills Left",
                skillsUsed,
                skillsLimit,
                skillsRemaining,
                periodStart.toString(),
                periodEnd.toString(),
                "Resets " + RESET_FORMAT.format(periodEnd) + " (billing period)"
        );

        return new UsageLimitsResponse(
                jobs,
                ai,
                skillRuns,
                new RateLimitHint("AI skill requests", 30, "Per minute (middleware)"),
                new RateLimitHint("API requests", 120, "Per minute burst (authenticated)"),
                QUOTA_ZONE.getId(),
                effectivePlan.name()
        );
    }

    static Instant nextMidnightInstant() {
        ZonedDateTime now = ZonedDateTime.now(QUOTA_ZONE);
        return now.toLocalDate().plusDays(1).atStartOfDay(QUOTA_ZONE).toInstant();
    }
}
