package com.careerops.service;

import com.careerops.model.ApplicationTask;
import com.careerops.repository.ApplicationTaskRepository;
import com.careerops.repository.DailyFetchLogRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Task 124 — Added nightly expired-refresh-token purge at 02:00 Dublin time.
 * Phase 3 — Added deadline-reminder cron at 08:30 Dublin time.
 *
 * All cron schedules (Dublin timezone):
 *   02:00        — purgeExpiredRefreshTokens
 *   03:00        — pruneFetchLogs
 *   07:50        — pruneSeenJobs
 *   08:00        — dailyJobRefresh
 *   08:30        — sendDeadlineReminders   ← Phase 3 addition
 *   09:05        — dailyDigestEmail
 *   08:00 MON    — weeklyDigestEmail
 */
@Service
public class CronJobService {
    private static final Logger log = LoggerFactory.getLogger(CronJobService.class);

    private static final int SEEN_JOBS_RETAIN_DAYS  = 60;
    private static final int FETCH_LOG_RETAIN_DAYS  = 90;
    /** Number of days ahead to look for upcoming deadlines. */
    private static final int DEADLINE_LOOKAHEAD_DAYS = 2;

    private final JobDeliveryService          delivery;
    private final UserProfileRepository       profiles;
    private final JobDigestService            digest;
    private final DeduplicationService        dedup;
    private final DailyFetchLogRepository     fetchLogs;
    private final WeeklyDigestService         weeklyDigest;
    private final UserRepository              users;
    private final ApplicationTaskRepository   taskRepo;
    private final EmailService                email;

    public CronJobService(JobDeliveryService d, UserProfileRepository p,
                          JobDigestService digest, DeduplicationService dedup,
                          DailyFetchLogRepository fetchLogs,
                          WeeklyDigestService weeklyDigest,
                          UserRepository users,
                          ApplicationTaskRepository taskRepo,
                          EmailService email) {
        this.delivery      = d;
        this.profiles      = p;
        this.digest        = digest;
        this.dedup         = dedup;
        this.fetchLogs     = fetchLogs;
        this.weeklyDigest  = weeklyDigest;
        this.users         = users;
        this.taskRepo      = taskRepo;
        this.email         = email;
    }

    // ─── 02:00 — purge expired refresh tokens ─────────────────────────────────

    @Scheduled(cron = "0 0 2 * * *", zone = "Europe/Dublin")
    public void purgeExpiredRefreshTokens() {
        log.info("Refresh-token purge cron firing");
        try {
            int purged = users.purgeExpiredRefreshTokens(Instant.now());
            log.info("Purged {} expired refresh token(s)", purged);
        } catch (Exception e) {
            log.warn("Refresh-token purge failed: {}", e.getMessage());
        }
    }

    // ─── 03:00 — prune fetch logs ──────────────────────────────────────────────

    @Scheduled(cron = "0 0 3 * * *", zone = "Europe/Dublin")
    public void pruneFetchLogs() {
        log.info("Fetch-log prune cron firing");
        try {
            fetchLogs.deleteByFetchDateBefore(LocalDate.now().minusDays(FETCH_LOG_RETAIN_DAYS));
        } catch (Exception e) {
            log.warn("Fetch-log prune failed: {}", e.getMessage());
        }
    }

    // ─── 07:50 — prune seen jobs ───────────────────────────────────────────────

    @Scheduled(cron = "0 50 7 * * *", zone = "Europe/Dublin")
    public void pruneSeenJobs() {
        log.info("Seen-jobs prune cron firing");
        try {
            dedup.pruneOldSeenJobs(SEEN_JOBS_RETAIN_DAYS);
        } catch (Exception e) {
            log.warn("Seen-jobs prune failed: {}", e.getMessage());
        }
    }

    // ─── 08:00 — daily job delivery ───────────────────────────────────────────

    @Scheduled(cron = "0 0 8 * * *", zone = "Europe/Dublin")
    public void dailyJobRefresh() {
        log.info("Daily job delivery cron firing");
        int share = delivery.cronShare();
        for (var p : profiles.findAllByOnboardedTrue()) {
            try {
                delivery.deliver(p.getUserId(), share);
            } catch (Exception e) {
                log.warn("cron deliver failed for {}: {}", p.getUserId(), e.getMessage());
            }
        }
    }

    // ─── 08:30 — deadline reminders (Phase 3) ─────────────────────────────────

    /**
     * Fires at 08:30 every day. Finds all ApplicationTask rows whose dueDate
     * falls within the next DEADLINE_LOOKAHEAD_DAYS days and sends a reminder
     * email to the task owner.
     *
     * Uses EmailService.sendDeadlineReminder(to, taskTitle, dueDate).
     * Skips tasks already completed (status == DONE) and tasks with no due date.
     */
    @Scheduled(cron = "0 30 8 * * *", zone = "Europe/Dublin")
    public void sendDeadlineReminders() {
        log.info("Deadline reminder cron firing");
        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(DEADLINE_LOOKAHEAD_DAYS);
        try {
            List<ApplicationTask> upcoming =
                    taskRepo.findUpcomingDeadlines(today, horizon);
            if (upcoming.isEmpty()) {
                log.info("No upcoming deadlines in next {} days", DEADLINE_LOOKAHEAD_DAYS);
                return;
            }
            int sent = 0;
            for (ApplicationTask task : upcoming) {
                try {
                    // Fetch user email via UserRepository
                    users.findById(task.getUserId()).ifPresent(user -> {
                        email.sendDeadlineReminder(
                                user.getEmail(),
                                task.getTitle(),
                                task.getDueDate());
                    });
                    sent++;
                } catch (Exception ex) {
                    log.warn("Deadline reminder failed for task {}: {}",
                            task.getId(), ex.getMessage());
                }
            }
            log.info("Deadline reminders sent: {}/{}", sent, upcoming.size());
        } catch (Exception e) {
            log.warn("Deadline reminder cron failed: {}", e.getMessage());
        }
    }

    // ─── 09:05 — daily digest emails ──────────────────────────────────────────

    @Scheduled(cron = "0 5 9 * * *", zone = "Europe/Dublin")
    public void dailyDigestEmail() {
        log.info("Daily digest email cron firing");
        try {
            digest.sendDigestsForAllUsers();
        } catch (Exception e) {
            log.warn("Digest cron failed: {}", e.getMessage());
        }
    }

    // ─── 08:00 MON — weekly digest ────────────────────────────────────────────

    @Scheduled(cron = "0 0 8 * * MON", zone = "Europe/Dublin")
    public void weeklyDigestEmail() {
        log.info("Weekly digest email cron firing");
        try {
            weeklyDigest.sendDigestsForAllUsers();
        } catch (Exception e) {
            log.warn("Weekly digest cron failed: {}", e.getMessage());
        }
    }
}
