package com.careerops.scheduler;

import com.careerops.model.ApplicationTask;
import com.careerops.model.DeadlineEvent;
import com.careerops.model.Notification;
import com.careerops.repository.ApplicationTaskRepository;
import com.careerops.repository.DeadlineEventRepository;
import com.careerops.repository.NotificationRepository;
import com.careerops.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tasks 28, 29, 30 — Recurring reminder logic.
 * Runs every 6 hours:
 *   - Notifies about overdue tasks (Task 30)
 *   - Sends email reminders for upcoming deadlines (Tasks 28, 29)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PlannerReminderScheduler {

    private final ApplicationTaskRepository taskRepo;
    private final DeadlineEventRepository deadlineRepo;
    private final NotificationRepository notificationRepo;
    private final EmailService emailService;

    /** Task 30 — Notify overdue tasks every 6 hours */
    @Scheduled(cron = "0 0 */6 * * *", zone = "Europe/Dublin")
    @org.springframework.transaction.annotation.Transactional
    public void notifyOverdueTasks() {
        // 3.090 — Add jitter
        try { Thread.sleep(new java.util.Random().nextInt(30000)); } 
        catch (InterruptedException e) { Thread.currentThread().interrupt(); }
 
        List<ApplicationTask> overdue = taskRepo
                .findByStatusAndDueDateBeforeAndReminderSentFalse("PENDING", Instant.now());
 
        if (overdue.isEmpty()) {
            return;
        }

        java.util.ArrayList<Notification> notificationsToSave = new java.util.ArrayList<>();
        for (ApplicationTask task : overdue) {
            Notification n = Notification.builder()
                    .id(UUID.randomUUID())
                    .userId(task.getUserId())
                    .type("OVERDUE_TASK")
                    .title("Overdue task!")
                    .body("\"" + task.getTitle() + "\" was due and hasn't been completed yet.")
                    .read(false)
                    .createdAt(Instant.now())
                    .metadata(Map.of("entityType", "application_task", "entityId", task.getId().toString()))
                    .build();
            notificationsToSave.add(n);
 
            task.setReminderSent(true);
            log.info("Overdue notification staged for taskId={}", task.getId());
        }

        notificationRepo.saveAll(notificationsToSave);
        taskRepo.saveAll(overdue);
        log.info("Successfully batched and saved {} overdue task reminders.", overdue.size());
    }

    /** 
     * Tasks 28, 29 — Email reminders for deadlines within 24 hours.
     * This is the CANONICAL and sole source-of-truth scheduler for DeadlineEvent reminders (08:00 Europe/Dublin).
     */
    @Scheduled(cron = "0 0 8 * * *", zone = "Europe/Dublin") // Every day at 08:00
    @org.springframework.transaction.annotation.Transactional
    public void sendDeadlineEmailReminders() {
        // 3.090 — Add jitter
        try { Thread.sleep(new java.util.Random().nextInt(30000)); } 
        catch (InterruptedException e) { Thread.currentThread().interrupt(); }
 
        Instant now = Instant.now();
        Instant in24 = now.plus(java.time.Duration.ofHours(24));
 
        List<DeadlineEvent> upcoming = deadlineRepo
                .findByEventDateBetweenAndReminderSentFalse(now, in24);
 
        for (DeadlineEvent event : upcoming) {
            emailService.sendDeadlineReminder(
                    event.getUserId(),
                    event.getTitle(),
                    event.getEventType(),
                    event.getEventDate()
            );
 
            event.setReminderSent(true);
            deadlineRepo.save(event);
            log.info("Deadline reminder email sent for eventId={}", event.getId());
        }
    }
}
