package com.careerops.service;

import com.careerops.dto.UsageDtos.DailyQuota;
import com.careerops.dto.UsageDtos.RateLimitHint;
import com.careerops.dto.UsageDtos.UsageLimitsResponse;
import org.springframework.beans.factory.annotation.Value;
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
    private final long dailyTokenBudget;

    public UsageLimitService(
            DailyLimitService dailyLimitService,
            TokenUsageService tokenUsageService,
            @Value("${ai.daily.token.budget:500000}") long dailyTokenBudget) {
        this.dailyLimitService = dailyLimitService;
        this.tokenUsageService = tokenUsageService;
        this.dailyTokenBudget = dailyTokenBudget;
    }

    public UsageLimitsResponse snapshot(UUID userId) {
        int jobUsed = dailyLimitService.getCount(userId);
        int jobLimit = dailyLimitService.max();
        int jobRemaining = dailyLimitService.remaining(userId);

        long aiUsed = tokenUsageService.tokensUsedSinceStartOfQuotaDay(userId);
        long aiRemaining = Math.max(0, dailyTokenBudget - aiUsed);

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
                dailyTokenBudget,
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
