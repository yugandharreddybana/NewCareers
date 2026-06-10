package com.careerops.dto;

/**
 * User-facing quota snapshot for dashboard/nav and settings.
 */
public final class UsageDtos {

    private UsageDtos() {}

    public record DailyQuota(
            String key,
            String label,
            long used,
            long limit,
            long remaining,
            /** ISO-8601 instant when this quota resets. */
            String resetsAt,
            String resetDescription
    ) {}

    public record PeriodQuota(
            String key,
            String label,
            long used,
            long limit,
            long remaining,
            String periodStart,
            String resetsAt,
            String resetDescription
    ) {}

    public record RateLimitHint(
            String label,
            int requestsPerMinute,
            String windowDescription
    ) {}

    public record UsageLimitsResponse(
            DailyQuota jobDelivery,
            DailyQuota aiTokens,
            PeriodQuota skillRuns,
            RateLimitHint skillApi,
            RateLimitHint generalApi,
            String timezoneId,
            String planName
    ) {}
}
