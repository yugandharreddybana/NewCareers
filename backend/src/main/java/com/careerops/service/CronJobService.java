package com.careerops.service;

import com.careerops.repository.DailyFetchLogRepository;
import com.careerops.repository.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class CronJobService {
    private static final Logger log = LoggerFactory.getLogger(CronJobService.class);

    private static final int SEEN_JOBS_RETAIN_DAYS  = 60;
    private static final int FETCH_LOG_RETAIN_DAYS  = 90;

    private final JobDeliveryService      delivery;
    private final UserProfileRepository   profiles;
    private final JobDigestService        digest;
    private final DeduplicationService    dedup;
    private final DailyFetchLogRepository fetchLogs;
    private final WeeklyDigestService     weeklyDigest; // Section 8 — Task 92

    public CronJobService(JobDeliveryService d, UserProfileRepository p,
                          JobDigestService digest, DeduplicationService dedup,
                          DailyFetchLogRepository fetchLogs,
                          WeeklyDigestService weeklyDigest) {
        this.delivery      = d;
        this.profiles      = p;
        this.digest        = digest;
        this.dedup         = dedup;
        this.fetchLogs     = fetchLogs;
        this.weeklyDigest  = weeklyDigest;
    }

    /**
     * 03:00 every day — prune daily_fetch_log rows older than 90 days.
     */
    @Scheduled(cron = "0 0 3 * * *", zone = "Europe/Dublin")
    public void pruneFetchLogs() {
        log.info("Fetch-log prune cron firing");
        try {
            fetchLogs.deleteByFetchDateBefore(LocalDate.now().minusDays(FETCH_LOG_RETAIN_DAYS));
        } catch (Exception e) {
            log.warn("Fetch-log prune failed: {}", e.getMessage());
        }
    }

    /**
     * 07:50 every day — prune old seen_jobs rows before delivery runs.
     */
    @Scheduled(cron = "0 50 7 * * *", zone = "Europe/Dublin")
    public void pruneSeenJobs() {
        log.info("Seen-jobs prune cron firing");
        try {
            dedup.pruneOldSeenJobs(SEEN_JOBS_RETAIN_DAYS);
        } catch (Exception e) {
            log.warn("Seen-jobs prune failed: {}", e.getMessage());
        }
    }

    /**
     * 08:00 every day — deliver the daily job batch (default 3 jobs/user).
     */
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

    /**
     * 09:05 every day — send daily digest emails after delivery has finished.
     */
    @Scheduled(cron = "0 5 9 * * *", zone = "Europe/Dublin")
    public void dailyDigestEmail() {
        log.info("Daily digest email cron firing");
        try {
            digest.sendDigestsForAllUsers();
        } catch (Exception e) {
            log.warn("Digest cron failed: {}", e.getMessage());
        }
    }

    /**
     * Section 8 — Task 92
     * 08:00 every Monday — send weekly digest to all active users.
     *
     * Schedule: 0 0 8 * * MON  (second=0, minute=0, hour=8, every Monday)
     * Zone:     Europe/Dublin (IST / GMT, aligns with user base).
     *
     * Runs BEFORE the daily job delivery cron on Mondays (same time, but
     * Spring executes @Scheduled methods sequentially on the task executor;
     * adjust to 0 0 7 * * MON if you need strict ordering).
     *
     * The weekly digest includes:
     *   - Jobs matched last 7 days
     *   - Skills run last 7 days
     *   - Applications sent last 7 days
     *   - Top 3 matched new jobs with match scores
     */
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
