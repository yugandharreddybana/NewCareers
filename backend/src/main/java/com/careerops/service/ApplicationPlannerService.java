package com.careerops.service;

import com.careerops.model.ApplicationTask;
import com.careerops.model.DeadlineEvent;
import com.careerops.model.UserJob;
import com.careerops.repository.ApplicationTaskRepository;
import com.careerops.repository.DeadlineEventRepository;
import com.careerops.repository.UserJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApplicationPlannerService {

    private final ApplicationTaskRepository taskRepo;
    private final DeadlineEventRepository   deadlineRepo;
    private final UserJobRepository         userJobRepo;
    private final NotificationService       notificationService;

    // ── Auto-generate next-action tasks for a job ────────────────────────────
    @Transactional
    public List<ApplicationTask> generateTasks(UUID userJobId, UUID userId) {
        UserJob job = userJobRepo.findById(userJobId)
            .orElseThrow(() -> new IllegalArgumentException("Job not found: " + userJobId));

        String stage = job.getStatus() != null ? job.getStatus().toUpperCase() : "APPLIED";
        List<ApplicationTask> tasks = new ArrayList<>(buildTasksForStage(stage, userJobId, userId));

        // Persist only the auto-generated ones that don't already exist
        List<ApplicationTask> existing = taskRepo.findByUserJobIdOrderBySortOrderAscCreatedAtAsc(userJobId);
        Set<String> existingTitles = new HashSet<>();
        existing.forEach(t -> existingTitles.add(t.getTitle()));

        List<ApplicationTask> toSave = tasks.stream()
            .filter(t -> !existingTitles.contains(t.getTitle()))
            .toList();

        return taskRepo.saveAll(toSave);
    }

    // ── Mark a task as complete ──────────────────────────────────────────────
    @Transactional
    public ApplicationTask completeTask(UUID taskId, UUID userId) {
        ApplicationTask task = taskRepo.findById(taskId)
            .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        if (!task.getUserId().equals(userId))
            throw new SecurityException("Access denied");

        task.setStatus("DONE");
        task.setCompletedAt(OffsetDateTime.now());
        return taskRepo.save(task);
    }

    // ── Get upcoming tasks and deadlines for current user ────────────────────
    public Map<String, Object> getUpcoming(UUID userId) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime in14Days = now.plusDays(14);

        List<ApplicationTask> pendingTasks   = taskRepo.findByUserIdAndStatusOrderByDueDateAsc(userId, "PENDING");
        List<DeadlineEvent>   upcomingEvents = deadlineRepo.findUpcoming(userId, now, in14Days);
        List<ApplicationTask> overdueTasks   = taskRepo.findOverdueTasks(userId, now);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pendingTasks",   pendingTasks);
        result.put("upcomingEvents", upcomingEvents);
        result.put("overdueTasks",   overdueTasks);
        return result;
    }

    // ── Get all tasks for a specific job ─────────────────────────────────────
    public List<ApplicationTask> getTasksForJob(UUID userJobId) {
        return taskRepo.findByUserJobIdOrderBySortOrderAscCreatedAtAsc(userJobId);
    }

    // ── Get deadlines for a specific job ─────────────────────────────────────
    public List<DeadlineEvent> getDeadlinesForJob(UUID userJobId) {
        return deadlineRepo.findByUserJobIdOrderByEventDateAsc(userJobId);
    }

    // ── Create a deadline event ───────────────────────────────────────────────
    @Transactional
    public DeadlineEvent createDeadline(UUID userJobId, UUID userId, String eventType,
                                        String title, OffsetDateTime eventDate,
                                        OffsetDateTime remindAt, String notes) {
        DeadlineEvent event = DeadlineEvent.builder()
            .userJobId(userJobId)
            .userId(userId)
            .eventType(eventType)
            .title(title)
            .eventDate(eventDate)
            .remindAt(remindAt)
            .notes(notes)
            .build();
        return deadlineRepo.save(event);
    }

    // ── Fire pending reminders (called by scheduler) ──────────────────────────
    @Transactional
    public void processDueReminders() {
        List<DeadlineEvent> due = deadlineRepo.findDueReminders(OffsetDateTime.now());
        for (DeadlineEvent event : due) {
            try {
                notificationService.createNotification(
                    event.getUserId(),
                    "DEADLINE_REMINDER",
                    "⏰ Reminder: " + event.getTitle(),
                    "Your event '" + event.getTitle() + "' is coming up on "
                        + event.getEventDate().toLocalDate() + "."
                );
                event.setReminderSent(true);
                deadlineRepo.save(event);
            } catch (Exception ex) {
                log.warn("Failed to send reminder for deadline {}: {}", event.getId(), ex.getMessage());
            }
        }
    }

    // ── Stage-aware task templates ────────────────────────────────────────────
    private List<ApplicationTask> buildTasksForStage(String stage, UUID userJobId, UUID userId) {
        List<ApplicationTask> tasks = new ArrayList<>();
        int order = 0;

        switch (stage) {
            case "APPLIED" -> {
                tasks.add(task(userJobId, userId, "Send follow-up email",
                    "Follow up if no response within 5 business days",
                    "FOLLOW_UP", "MEDIUM", 5, order++));
                tasks.add(task(userJobId, userId, "Research the company culture",
                    "Check Glassdoor, LinkedIn, and the company blog",
                    "RESEARCH", "LOW", 3, order++));
            }
            case "PHONE_SCREEN", "FIRST_INTERVIEW" -> {
                tasks.add(task(userJobId, userId, "Schedule interview prep session",
                    "Use Interview Coach to run a mock interview",
                    "SCHEDULE_PREP", "HIGH", 2, order++));
                tasks.add(task(userJobId, userId, "Prepare STAR stories",
                    "Write 3-5 STAR format stories relevant to the role",
                    "SCHEDULE_PREP", "HIGH", 1, order++));
                tasks.add(task(userJobId, userId, "Research interviewer on LinkedIn",
                    "Find who you're meeting with",
                    "RESEARCH", "MEDIUM", 1, order++));
            }
            case "TECHNICAL_TEST" -> {
                tasks.add(task(userJobId, userId, "Complete technical assessment",
                    "Don't forget to submit before the deadline",
                    "SUBMIT_APPLICATION", "HIGH", 2, order++));
                tasks.add(task(userJobId, userId, "Review job description before test",
                    "Note technologies mentioned to focus prep",
                    "SCHEDULE_PREP", "MEDIUM", 1, order++));
            }
            case "FINAL_ROUND" -> {
                tasks.add(task(userJobId, userId, "Final interview prep",
                    "Deep-dive prep including executive level questions",
                    "SCHEDULE_PREP", "HIGH", 2, order++));
                tasks.add(task(userJobId, userId, "Prepare questions to ask",
                    "Prepare thoughtful questions for the panel",
                    "FINAL_REVIEW", "HIGH", 1, order++));
            }
            case "OFFER" -> {
                tasks.add(task(userJobId, userId, "Review offer letter carefully",
                    "Check salary, benefits, start date, equity",
                    "FINAL_REVIEW", "HIGH", 3, order++));
                tasks.add(task(userJobId, userId, "Negotiate if needed",
                    "Use Salary Negotiation skill for tailored advice",
                    "FOLLOW_UP", "HIGH", 3, order++));
            }
            default -> {
                tasks.add(task(userJobId, userId, "Review application status",
                    "Check for any updates or required actions",
                    "CUSTOM", "MEDIUM", 3, order++));
            }
        }
        return tasks;
    }

    private ApplicationTask task(UUID userJobId, UUID userId, String title,
                                  String description, String type, String priority,
                                  int dueDays, int sortOrder) {
        return ApplicationTask.builder()
            .userJobId(userJobId)
            .userId(userId)
            .title(title)
            .description(description)
            .taskType(type)
            .priority(priority)
            .status("PENDING")
            .dueDate(OffsetDateTime.now().plusDays(dueDays))
            .autoGenerated(true)
            .sortOrder(sortOrder)
            .build();
    }
}
