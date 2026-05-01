package com.careerops.service;

import com.careerops.repository.DailyFetchLogRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Task 124 — Added nightly expired-refresh-token purge at 02:00 Dublin time.
 *
 * All existing cron schedules are unchanged:
 *   03:00 — pruneFetchLogs
 *   07:50 — pruneSeenJobs
 *   08:00 — dailyJobRefresh
 *   09:05 — dailyDigestEmail
 *   08:00 MON — weeklyDigestEmail
 */
@Service
public class CronJobService {
    private static final Logger log = LoggerFactory.getLogger(CronJobService.class);

    private static final int SEEN_JOBS_RETAIN_DAYS = 60;
    private static final int FETCH_LOG_RETAIN_DAYS = 90;

    private final JobDeliveryService      delivery;
    private final UserProfileRepository   profiles;
    private final JobDigestService        digest;
    private final DeduplicationService    dedup;
    private final DailyFetchLogRepository fetchLogs;
    private final WeeklyDigestService     weeklyDigest;
    private final UserRepository          users; // Task 124

    public CronJobService(JobDeliveryService d, UserProfileRepository p,
                          JobDigestService digest, DeduplicationService dedup,
                          DailyFetchLogRepository fetchLogs,
                          WeeklyDigestService weeklyDigest,
                          UserRepository users) {
        this.delivery     = d;
        this.profiles     = p;
        this.digest       = digest;
        this.dedup        = dedup;
        this.fetchLogs    = fetchLogs;
        this.weeklyDigest = weeklyDigest;
        this.users        = users;
    }

    // ─── Task 124 — 02:00 — purge expired refresh tokens ──────────────────────

    /**
     * 02:00 every day — bulk-wipe refresh tokens whose expiry has passed.
     * Runs before all other crons so the DB is clean for the day.
     */
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

    // ─── Existing crons (unchanged) ────────────────────────────────────────────

    /** 03:00 every day — prune daily_fetch_log rows older than 90 days. */
    @Scheduled(cron = "0 0 3 * * *", zone = "Europe/Dublin")
    public void pruneFetchLogs() {
        log.info("Fetch-log prune cron firing");
        try {
            fetchLogs.deleteByFetchDateBefore(LocalDate.now().minusDays(FETCH_LOG_RETAIN_DAYS));
        } catch (Exception e) {
            log.warn("Fetch-log prune failed: {}", e.getMessage());
        }
    }

    /** 07:50 every day — prune old seen_jobs rows before delivery runs. */
    @Scheduled(cron = "0 50 7 * * *", zone = "Europe/Dublin")
    public void pruneSeenJobs() {
        log.info("Seen-jobs prune cron firing");
        try {
            dedup.pruneOldSeenJobs(SEEN_JOBS_RETAIN_DAYS);
        } catch (Exception e) {
            log.warn("Seen-jobs prune failed: {}", e.getMessage());
        }
    }

    /** 08:00 every day — deliver the daily job batch (default 3 jobs/user). */
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

    /** 09:05 every day — send daily digest emails after delivery has finished. */
    @Scheduled(cron = "0 5 9 * * *", zone = "Europe/Dublin")
    public void dailyDigestEmail() {
        log.info("Daily digest email cron firing");
        try {
            digest.sendDigestsForAllUsers();
        } catch (Exception e) {
            log.warn("Digest cron failed: {}", e.getMessage());
        }
    }

    /** Section 8 — Task 92 — 08:00 every Monday — send weekly digest. */
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
