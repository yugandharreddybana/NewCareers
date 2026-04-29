package com.careerops.service;

import com.careerops.repository.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class CronJobService {
    private static final Logger log = LoggerFactory.getLogger(CronJobService.class);

    private final JobDeliveryService delivery;
    private final UserProfileRepository profiles;
    private final JobDigestService digest;

    public CronJobService(JobDeliveryService d,
                          UserProfileRepository p,
                          JobDigestService digest) {
        this.delivery = d;
        this.profiles = p;
        this.digest   = digest;
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
