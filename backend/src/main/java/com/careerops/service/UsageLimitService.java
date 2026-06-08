package com.careerops.service;

import com.careerops.dto.UsageDtos.DailyQuota;
import com.careerops.dto.UsageDtos.RateLimitHint;
import com.careerops.dto.UsageDtos.UsageLimitsResponse;
import com.careerops.model.PlanTier;
import com.careerops.model.PlanTierLimits;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

@Service
public class UsageLimitService {

    public static final ZoneId QUOTA_ZONE = ZoneId.of("Europe/Dublin");

    private final DailyLimitService dailyLimitService;
    private final TokenUsageService tokenUsageService;
    private final UserPlanTierService planTierService;

    public UsageLimitService(
            DailyLimitService dailyLimitService,
            TokenUsageService tokenUsageService,
            UserPlanTierService planTierService) {
        this.dailyLimitService = dailyLimitService;
        this.tokenUsageService = tokenUsageService;
        this.planTierService = planTierService;
    }

    public UsageLimitsResponse snapshot(UUID userId) {
        PlanTier tier = planTierService.resolveForUser(userId);
        int jobUsed = dailyLimitService.getCount(userId);
        int jobLimit = dailyLimitService.maxFor(tier);
        int jobRemaining = dailyLimitService.remaining(userId);

        long tokenBudget = PlanTierLimits.tokenBudget(tier);
        long aiUsed = tokenUsageService.tokensUsedSinceStartOfQuotaDay(userId);
        long aiRemaining = Math.max(0, tokenBudget - aiUsed);

        Instant resetsAt = nextMidnightInstant();

        DailyQuota jobs = new DailyQuota(
                "job_delivery",
                "New jobs per day",
                jobUsed,
                jobLimit,
                jobRemaining,
                resetsAt.toString(),
                "Resets at midnight (" + QUOTA_ZONE.getId() + ")"
        );

        DailyQuota ai = new DailyQuota(
                "ai_tokens",
                "AI token budget",
                aiUsed,
                tokenBudget,
                aiRemaining,
                resetsAt.toString(),
                "Resets at midnight (" + QUOTA_ZONE.getId() + ")"
        );

        return new UsageLimitsResponse(
                jobs,
                ai,
                new RateLimitHint("AI skill requests", 30, "Per minute (middleware)"),
                new RateLimitHint("API requests", 60, "Per minute (authenticated)"),
                QUOTA_ZONE.getId()
        );
    }

    static Instant nextMidnightInstant() {
        ZonedDateTime now = ZonedDateTime.now(QUOTA_ZONE);
        return now.toLocalDate().plusDays(1).atStartOfDay(QUOTA_ZONE).toInstant();
    }
}
