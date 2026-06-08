package com.careerops.scheduler;

import com.careerops.service.TrialLifecycleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class TrialLifecycleScheduler {

    private final TrialLifecycleService trialLifecycleService;

    @Scheduled(cron = "0 0 9 * * *", zone = "UTC")
    public void runDailyTrialLifecycle() {
        log.info("Starting daily trial lifecycle job");
        try {
            trialLifecycleService.processDailyTrialLifecycle();
        } catch (Exception ex) {
            log.error("Daily trial lifecycle job failed: {}", ex.getMessage(), ex);
        }
    }
}
