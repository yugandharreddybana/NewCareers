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

    private static final int SEEN_JOBS_RETAIN_DAYS = 60;
    private static final int FETCH_LOG_RETAIN_DAYS = 90;

    private final JobDeliveryService      delivery;
    private final UserProfileRepository   profiles;
    private final JobDigestService        digest;
    private final DeduplicationService    dedup;
    private final DailyFetchLogRepository fetchLogs;

    public CronJobService(JobDeliveryService d, UserProfileRepository p,
                          JobDigestService digest, DeduplicationService dedup,
                          DailyFetchLogRepository fetchLogs) {
        this.delivery  = d;
        this.profiles  = p;
        this.digest    = digest;
        this.dedup     = dedup;
        this.fetchLogs = fetchLogs;
    }

    /**
     * 03:00 every day — prune daily_fetch_log rows older than 90 days.
     * Runs at a quiet hour well before delivery to keep the table lean.
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
     * Keeps the table lean and dedup queries fast.
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
     * Gemini scoring runs in parallel so this completes in ~15s per user.
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
     * Runs 65 minutes after the delivery cron to ensure all jobs are scored.
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
}
