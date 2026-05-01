package com.careerops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class ProgressDTO {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class WeeklySummaryResponse {
        private UUID id;
        private LocalDate weekStart;
        private LocalDate weekEnd;
        private int jobsReviewed;
        private int applicationsSubmitted;
        private int interviewsScheduled;
        private int responsesReceived;
        private int offersReceived;
        private int dailyUseStreak;
        private String winsSummary;
        private String bottlenecksSummary;
        private String recommendations;
        private String bestPerformingCategory;
        private BigDecimal responseRate;
        private BigDecimal interviewRate;
        private Instant createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class StreakResponse {
        private int currentDailyStreak;
        private int longestDailyStreak;
        private LocalDate lastActiveDate;
        private int totalJobsReviewed;
        private int totalAppsSubmitted;
        private List<BadgeDTO> badges;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BadgeDTO {
        private String key;        // e.g. "streak_7", "apps_10"
        private String label;      // e.g. "7-Day Streak!"
        private String icon;       // emoji or icon key
        private boolean earned;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HistoryResponse {
        private List<WeeklySummaryResponse> weeks;
        private StreakResponse streak;
    }
}
