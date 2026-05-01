package com.careerops.service;

import com.careerops.dto.ProgressDTO;
import com.careerops.model.UserStreak;
import com.careerops.model.WeeklyProgressSnapshot;
import com.careerops.repository.UserStreakRepository;
import com.careerops.repository.WeeklyProgressSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProgressInsightService {

    private final WeeklyProgressSnapshotRepository snapshotRepo;
    private final UserStreakRepository streakRepo;

    // ------------------------------------------------------------------
    // Task 61 — GET /progress/weekly-summary
    // ------------------------------------------------------------------
    public ProgressDTO.WeeklySummaryResponse getWeeklySummary(UUID userId) {
        LocalDate weekStart = LocalDate.now(ZoneOffset.UTC)
                .with(DayOfWeek.MONDAY);
        WeeklyProgressSnapshot snap = snapshotRepo
                .findByUserIdAndWeekStart(userId, weekStart)
                .orElseGet(() -> buildEmptySnapshot(userId, weekStart));
        return toSummaryResponse(snap);
    }

    // ------------------------------------------------------------------
    // Task 62 — GET /progress/streaks
    // ------------------------------------------------------------------
    public ProgressDTO.StreakResponse getStreaks(UUID userId) {
        UserStreak streak = streakRepo.findByUserId(userId)
                .orElseGet(() -> UserStreak.builder()
                        .userId(userId)
                        .currentDailyStreak(0)
                        .longestDailyStreak(0)
                        .totalJobsReviewed(0)
                        .totalAppsSubmitted(0)
                        .build());
        return ProgressDTO.StreakResponse.builder()
                .currentDailyStreak(streak.getCurrentDailyStreak())
                .longestDailyStreak(streak.getLongestDailyStreak())
                .lastActiveDate(streak.getLastActiveDate())
                .totalJobsReviewed(streak.getTotalJobsReviewed())
                .totalAppsSubmitted(streak.getTotalAppsSubmitted())
                .badges(buildBadges(streak))
                .build();
    }

    // ------------------------------------------------------------------
    // Task 60 — Generate/refresh weekly summary (called by scheduler or on-demand)
    // ------------------------------------------------------------------
    @Transactional
    public WeeklyProgressSnapshot generateSnapshot(UUID userId, int jobsReviewed,
                                                    int appsSubmitted, int interviewsScheduled,
                                                    int responsesReceived, int offersReceived) {
        LocalDate weekStart = LocalDate.now(ZoneOffset.UTC).with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        WeeklyProgressSnapshot snap = snapshotRepo
                .findByUserIdAndWeekStart(userId, weekStart)
                .orElseGet(() -> WeeklyProgressSnapshot.builder()
                        .userId(userId)
                        .weekStart(weekStart)
                        .weekEnd(weekEnd)
                        .build());

        snap.setJobsReviewed(jobsReviewed);
        snap.setApplicationsSubmitted(appsSubmitted);
        snap.setInterviewsScheduled(interviewsScheduled);
        snap.setResponsesReceived(responsesReceived);
        snap.setOffersReceived(offersReceived);

        // Compute rates
        if (appsSubmitted > 0) {
            snap.setResponseRate(BigDecimal.valueOf(responsesReceived)
                    .divide(BigDecimal.valueOf(appsSubmitted), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP));
            snap.setInterviewRate(BigDecimal.valueOf(interviewsScheduled)
                    .divide(BigDecimal.valueOf(appsSubmitted), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP));
        }

        // Task 60 — AI-generated narrative (stub; wire to GeminiService when available)
        snap.setWinsSummary(generateWins(snap));
        snap.setBottlenecksSummary(generateBottlenecks(snap));
        snap.setRecommendations(generateRecommendations(snap));

        // Task 68 — best performing category heuristic
        snap.setBestPerformingCategory(deriveBestCategory(snap));

        return snapshotRepo.save(snap);
    }

    // ------------------------------------------------------------------
    // Task 64 — record daily activity + update streak
    // ------------------------------------------------------------------
    @Transactional
    public ProgressDTO.StreakResponse recordDailyActivity(UUID userId) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        UserStreak streak = streakRepo.findByUserId(userId)
                .orElseGet(() -> UserStreak.builder().userId(userId)
                        .currentDailyStreak(0).longestDailyStreak(0).build());

        LocalDate last = streak.getLastActiveDate();
        if (last == null || last.isBefore(today.minusDays(1))) {
            streak.setCurrentDailyStreak(1);
        } else if (last.isEqual(today.minusDays(1))) {
            streak.setCurrentDailyStreak(streak.getCurrentDailyStreak() + 1);
        }
        // already recorded today — no change

        if (streak.getCurrentDailyStreak() > streak.getLongestDailyStreak()) {
            streak.setLongestDailyStreak(streak.getCurrentDailyStreak());
        }
        streak.setLastActiveDate(today);
        streakRepo.save(streak);
        return getStreaks(userId);
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------
    private WeeklyProgressSnapshot buildEmptySnapshot(UUID userId, LocalDate weekStart) {
        return WeeklyProgressSnapshot.builder()
                .userId(userId).weekStart(weekStart).weekEnd(weekStart.plusDays(6))
                .jobsReviewed(0).applicationsSubmitted(0).interviewsScheduled(0)
                .responsesReceived(0).offersReceived(0).dailyUseStreak(0).maxDailyUseStreak(0)
                .build();
    }

    private String generateWins(WeeklyProgressSnapshot s) {
        if (s.getApplicationsSubmitted() == 0 && s.getJobsReviewed() == 0)
            return "No activity recorded yet this week. Start by reviewing some jobs!";
        return String.format("You reviewed %d job%s and submitted %d application%s this week.",
                s.getJobsReviewed(), s.getJobsReviewed() == 1 ? "" : "s",
                s.getApplicationsSubmitted(), s.getApplicationsSubmitted() == 1 ? "" : "s");
    }

    private String generateBottlenecks(WeeklyProgressSnapshot s) {
        if (s.getApplicationsSubmitted() > 5 && s.getResponsesReceived() == 0)
            return "You have applied to several roles but haven't received a response yet. Consider tailoring your CV more closely to each role.";
        if (s.getJobsReviewed() > 10 && s.getApplicationsSubmitted() == 0)
            return "You're reviewing many jobs but not converting to applications. Try setting a daily application goal.";
        return null;
    }

    private String generateRecommendations(WeeklyProgressSnapshot s) {
        List<String> tips = new ArrayList<>();
        if (s.getApplicationsSubmitted() < 3)
            tips.add("Aim for at least 3 applications this week to build momentum.");
        if (s.getInterviewsScheduled() == 0 && s.getApplicationsSubmitted() > 2)
            tips.add("Follow up on applications older than 7 days to increase your response rate.");
        if (tips.isEmpty()) tips.add("Keep up the great work — consistency is key!");
        return String.join(" ", tips);
    }

    private String deriveBestCategory(WeeklyProgressSnapshot s) {
        // Heuristic: placeholder — in production this would query job categories from user_jobs
        if (s.getResponseRate() != null && s.getResponseRate().compareTo(BigDecimal.valueOf(20)) > 0)
            return "Tech / Software Engineering";
        return null;
    }

    // Task 65 — badges
    private List<ProgressDTO.BadgeDTO> buildBadges(UserStreak s) {
        List<ProgressDTO.BadgeDTO> badges = new ArrayList<>();
        badges.add(ProgressDTO.BadgeDTO.builder().key("streak_3").label("3-Day Streak").icon("🔥")
                .earned(s.getCurrentDailyStreak() >= 3).build());
        badges.add(ProgressDTO.BadgeDTO.builder().key("streak_7").label("7-Day Streak").icon("☕")
                .earned(s.getCurrentDailyStreak() >= 7).build());
        badges.add(ProgressDTO.BadgeDTO.builder().key("streak_30").label("30-Day Streak").icon("🏆")
                .earned(s.getCurrentDailyStreak() >= 30).build());
        badges.add(ProgressDTO.BadgeDTO.builder().key("apps_5").label("5 Applications").icon("💼")
                .earned(s.getTotalAppsSubmitted() >= 5).build());
        badges.add(ProgressDTO.BadgeDTO.builder().key("apps_25").label("25 Applications").icon("🚀")
                .earned(s.getTotalAppsSubmitted() >= 25).build());
        badges.add(ProgressDTO.BadgeDTO.builder().key("jobs_50").label("50 Jobs Reviewed").icon("🔍")
                .earned(s.getTotalJobsReviewed() >= 50).build());
        return badges;
    }

    private ProgressDTO.WeeklySummaryResponse toSummaryResponse(WeeklyProgressSnapshot s) {
        return ProgressDTO.WeeklySummaryResponse.builder()
                .id(s.getId()).weekStart(s.getWeekStart()).weekEnd(s.getWeekEnd())
                .jobsReviewed(s.getJobsReviewed()).applicationsSubmitted(s.getApplicationsSubmitted())
                .interviewsScheduled(s.getInterviewsScheduled()).responsesReceived(s.getResponsesReceived())
                .offersReceived(s.getOffersReceived()).dailyUseStreak(s.getDailyUseStreak())
                .winsSummary(s.getWinsSummary()).bottlenecksSummary(s.getBottlenecksSummary())
                .recommendations(s.getRecommendations()).bestPerformingCategory(s.getBestPerformingCategory())
                .responseRate(s.getResponseRate()).interviewRate(s.getInterviewRate())
                .createdAt(s.getCreatedAt()).build();
    }
}
