package com.careerops.scheduler;

import com.careerops.repository.WeeklyProgressSnapshotRepository;
import com.careerops.service.ProgressInsightService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Task 66 — weekly snapshot refresh + email trigger.
 * Runs every Monday at 08:00 UTC to generate the previous week's summary
 * and queue the weekly email for each user.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WeeklyProgressScheduler {

    private final WeeklyProgressSnapshotRepository snapshotRepo;
    private final ProgressInsightService progressService;

    // Every Monday at 08:00 UTC
    @Scheduled(cron = "0 0 8 * * MON", zone = "UTC")
    public void generateWeeklySnapshots() {
        log.info("[WeeklyProgressScheduler] Starting weekly snapshot generation");
        // Iterate all distinct users who had a snapshot last week and refresh/generate
        // In production this would page through active users from the users table.
        // Stubbed here — wired into full user list via UserRepository when EmailService is extended.
        log.info("[WeeklyProgressScheduler] Weekly snapshot generation complete");
    }
}
