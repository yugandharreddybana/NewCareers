package com.careerops.service;

import org.jspecify.annotations.Nullable;

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
    private final com.careerops.repository.DailyActivityRepository activityRepo;

    // ------------------------------------------------------------------
    // Task 61 — GET /progress/weekly-summary (current week)
    // ------------------------------------------------------------------
    public ProgressDTO.WeeklySummaryResponse getWeeklySummary(UUID userId) {
        LocalDate weekStart = LocalDate.now(ZoneOffset.UTC).with(DayOfWeek.MONDAY);
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
                        .userId(userId).currentDailyStreak(0).longestDailyStreak(0)
                        .totalJobsReviewed(0).totalAppsSubmitted(0).build());
        return buildStreakResponse(streak);
    }

    // ------------------------------------------------------------------
    // Task 67 — GET /progress/history?weeks=N (for chart widgets)
    // ------------------------------------------------------------------
    public List<ProgressDTO.WeeklySummaryResponse> getHistory(UUID userId, int weeks) {
        LocalDate from = LocalDate.now(ZoneOffset.UTC)
                .with(DayOfWeek.MONDAY)
                .minusWeeks(Math.max(1, Math.min(weeks, 52)));
        return snapshotRepo.findRecentByUser(userId, from)
                .stream()
                .map(this::toSummaryResponse)
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------
    // Task 68 — GET /progress/full (single round-trip for ProgressPage)
    // ------------------------------------------------------------------
    public ProgressDTO.HistoryResponse getFullHistory(UUID userId) {
        List<ProgressDTO.WeeklySummaryResponse> weeks = getHistory(userId, 8);
        ProgressDTO.StreakResponse streak = getStreaks(userId);
        return ProgressDTO.HistoryResponse.builder().weeks(weeks).streak(streak).build();
    }

    // ------------------------------------------------------------------
    // Task 60 — Generate/refresh snapshot (called on-demand or by scheduler)
    // ------------------------------------------------------------------
    @Transactional(timeout = 10)
    public WeeklyProgressSnapshot generateSnapshot(UUID userId, int jobsReviewed,
                                                    int appsSubmitted, int interviewsScheduled,
                                                    int responsesReceived, int offersReceived) {
        LocalDate weekStart = LocalDate.now(ZoneOffset.UTC).with(DayOfWeek.MONDAY);
        LocalDate weekEnd   = weekStart.plusDays(6);

        WeeklyProgressSnapshot snap = snapshotRepo
                .findByUserIdAndWeekStart(userId, weekStart)
                .orElseGet(() -> WeeklyProgressSnapshot.builder()
                        .userId(userId).weekStart(weekStart).weekEnd(weekEnd).build());

        snap.setJobsReviewed(jobsReviewed);
        snap.setApplicationsSubmitted(appsSubmitted);
        snap.setInterviewsScheduled(interviewsScheduled);
        snap.setResponsesReceived(responsesReceived);
        snap.setOffersReceived(offersReceived);

        if (appsSubmitted > 0) {
            snap.setResponseRate(rate(responsesReceived, appsSubmitted));
            snap.setInterviewRate(rate(interviewsScheduled, appsSubmitted));
        }

        snap.setWinsSummary(generateWins(snap));
        snap.setBottlenecksSummary(generateBottlenecks(snap));
        snap.setRecommendations(generateRecommendations(snap));
        snap.setBestPerformingCategory(deriveBestCategory(snap));

        return snapshotRepo.save(snap);
    }

    // ------------------------------------------------------------------
    // Task 64 — Record daily activity + update streak
    // ------------------------------------------------------------------
    @Transactional(timeout = 10)
    public ProgressDTO.StreakResponse recordDailyActivity(UUID userId) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        // 2.067 — Idempotency: try to record activity for today
        int inserted = activityRepo.recordIdempotent(userId, today);
        
        UserStreak streak = streakRepo.findByUserId(userId)
                .orElseGet(() -> UserStreak.builder().userId(userId)
                        .currentDailyStreak(0).longestDailyStreak(0).build());

        if (inserted > 0) {
            LocalDate last = streak.getLastActiveDate();
            if (last == null || last.isBefore(today.minusDays(1))) {
                streak.setCurrentDailyStreak(1);
            } else if (last.isEqual(today.minusDays(1))) {
                streak.setCurrentDailyStreak(streak.getCurrentDailyStreak() + 1);
            }
            
            if (streak.getCurrentDailyStreak() > streak.getLongestDailyStreak()) {
                streak.setLongestDailyStreak(streak.getCurrentDailyStreak());
            }
            streak.setLastActiveDate(today);
            streakRepo.save(streak);
        }

        return buildStreakResponse(streak);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    private BigDecimal rate(int numerator, int denominator) {
        return BigDecimal.valueOf(numerator)
                .divide(BigDecimal.valueOf(denominator), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

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

    private @Nullable String generateBottlenecks(WeeklyProgressSnapshot s) {
        if (s.getApplicationsSubmitted() > 5 && s.getResponsesReceived() == 0)
            return "You've applied to several roles but haven't received a response yet. Consider tailoring your CV more closely to each role.";
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

    private @Nullable String deriveBestCategory(WeeklyProgressSnapshot s) {
        if (s.getResponseRate() != null && s.getResponseRate().compareTo(BigDecimal.valueOf(20)) > 0)
            return "Tech / Software Engineering";
        return null;
    }

    // Task 65 — badges
    private List<ProgressDTO.BadgeDTO> buildBadges(UserStreak s) {
        List<ProgressDTO.BadgeDTO> badges = new ArrayList<>();
        badges.add(badge("streak_3",  "3-Day Streak",      "\uD83D\uDD25", s.getCurrentDailyStreak() >= 3));
        badges.add(badge("streak_7",  "7-Day Streak",      "\u2615",       s.getCurrentDailyStreak() >= 7));
        badges.add(badge("streak_30", "30-Day Streak",     "\uD83C\uDFC6", s.getCurrentDailyStreak() >= 30));
        badges.add(badge("apps_5",    "5 Applications",    "\uD83D\uDCBC", s.getTotalAppsSubmitted() >= 5));
        badges.add(badge("apps_25",   "25 Applications",   "\uD83D\uDE80", s.getTotalAppsSubmitted() >= 25));
        badges.add(badge("jobs_50",   "50 Jobs Reviewed",  "\uD83D\uDD0D", s.getTotalJobsReviewed() >= 50));
        return badges;
    }

    private ProgressDTO.BadgeDTO badge(String key, String label, String icon, boolean earned) {
        return ProgressDTO.BadgeDTO.builder().key(key).label(label).icon(icon).earned(earned).build();
    }

    private ProgressDTO.StreakResponse buildStreakResponse(UserStreak s) {
        return ProgressDTO.StreakResponse.builder()
                .currentDailyStreak(s.getCurrentDailyStreak())
                .longestDailyStreak(s.getLongestDailyStreak())
                .lastActiveDate(s.getLastActiveDate())
                .totalJobsReviewed(s.getTotalJobsReviewed())
                .totalAppsSubmitted(s.getTotalAppsSubmitted())
                .badges(buildBadges(s))
                .build();
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
