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

import java.time.LocalDateTime;
import java.util.List;
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
    @Scheduled(cron = "0 0 */6 * * *")
    public void notifyOverdueTasks() {
        List<ApplicationTask> overdue = taskRepo
                .findByStatusAndDueDateBeforeAndReminderSentFalse("PENDING", LocalDateTime.now());

        for (ApplicationTask task : overdue) {
            try {
                Notification n = new Notification();
                n.setId(UUID.randomUUID());
                n.setUserId(task.getUserId());
                n.setType("OVERDUE_TASK");
                n.setTitle("Overdue task!");
                n.setMessage("\"" + task.getTitle() + "\" was due and hasn't been completed yet.");
                n.setRead(false);
                n.setCreatedAt(LocalDateTime.now());
                n.setEntityType("application_task");
                n.setEntityId(task.getId().toString());
                notificationRepo.save(n);

                task.setReminderSent(true);
                taskRepo.save(task);
                log.info("Overdue notification created for taskId={}", task.getId());
            } catch (Exception e) {
                log.error("Failed to notify overdue task {}: {}", task.getId(), e.getMessage());
            }
        }
    }

    /** Tasks 28, 29 — Email reminders for deadlines within 24 hours */
    @Scheduled(cron = "0 0 8 * * *") // Every day at 08:00
    public void sendDeadlineEmailReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime in24 = now.plusHours(24);

        List<DeadlineEvent> upcoming = deadlineRepo
                .findByEventDateBetweenAndReminderSentFalse(now, in24);

        for (DeadlineEvent event : upcoming) {
            try {
                emailService.sendDeadlineReminder(
                        event.getUserId(),
                        event.getTitle(),
                        event.getEventType(),
                        event.getEventDate()
                );

                event.setReminderSent(true);
                deadlineRepo.save(event);
                log.info("Deadline reminder email sent for eventId={}", event.getId());
            } catch (Exception e) {
                log.error("Failed to send deadline reminder for eventId={}: {}", event.getId(), e.getMessage());
            }
        }
    }
}
