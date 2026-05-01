package com.careerops.scheduler;

import com.careerops.service.ApplicationPlannerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PlannerReminderScheduler {

    private final ApplicationPlannerService plannerService;

    /**
     * Every 15 minutes: check for deadline events whose remind_at has passed
     * and fire in-app notifications + mark reminder_sent = true.
     */
    @Scheduled(fixedDelay = 900_000) // 15 min in ms
    public void processReminders() {
        log.info("[PlannerReminderScheduler] Checking for due reminders...");
        try {
            plannerService.processDueReminders();
        } catch (Exception ex) {
            log.error("[PlannerReminderScheduler] Error processing reminders: {}", ex.getMessage(), ex);
        }
    }
}
