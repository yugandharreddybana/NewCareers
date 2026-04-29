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

    public CronJobService(JobDeliveryService d, UserProfileRepository p) {
        this.delivery = d; this.profiles = p;
    }

    /** 08:00 every day — deliver the cron share (default 3 jobs/user). */
    @Scheduled(cron = "0 0 8 * * *", zone = "Europe/Dublin")
    public void dailyJobRefresh() {
        log.info("Daily cron firing");
        int share = delivery.cronShare();
        for (var p : profiles.findAllByOnboardedTrue()) {
            try {
                delivery.deliver(p.getUserId(), share);
            } catch (Exception e) {
                log.warn("cron deliver failed for {}: {}", p.getUserId(), e.getMessage());
            }
        }
    }
}
