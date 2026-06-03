package com.careerops.service;

import com.careerops.dto.ApplicationPlannerDtos.JobStatus;
import com.careerops.dto.ApplicationPlannerDtos.PlanRequest;
import com.careerops.dto.ApplicationPlannerDtos.PlanResponse;
import com.careerops.dto.ApplicationPlannerDtos.TaskItem;
import com.careerops.exception.ApiException;
import com.careerops.model.ApplicationTask;
import com.careerops.model.DeadlineEvent;
import com.careerops.model.Job;
import com.careerops.model.Notification;
import com.careerops.model.UserJob;
import com.careerops.repository.ApplicationTaskRepository;
import com.careerops.repository.DeadlineEventRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.NotificationRepository;
import com.careerops.repository.UserJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Task 21 — ApplicationPlannerService
 *
 * Batch 3 update:
 *  - generatePlanAsync() runs the heavy Gemini call in a background thread (@Async).
 *    The controller returns 202 Accepted immediately; the client polls or receives
 *    a WebSocket/SSE notification when the plan is ready.
 *  - generatePlan() is kept as a synchronous convenience for internal callers
 *    (cron jobs, tests, etc.).
 *  - On completion, a PLANNER_READY notification is pushed to NotificationRepository
 *    (picked up by the SSE notification stream).
 *
 * B2-G3 / B3 controller wiring fix:
 *  - Added DTO-based overloads consumed by ApplicationPlannerController.
 *  - Added in-memory job result cache for async polling.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ApplicationPlannerService {

    private final UserJobRepository userJobRepo;
    private final JobRepository jobRepo;
    private final ApplicationTaskRepository taskRepo;
    private final DeadlineEventRepository deadlineRepo;
    private final NotificationRepository notificationRepo;
    private final GeminiService geminiService;
    private final AiProviderMetricsService aiMetrics;

    /**
     * In-memory store for async job results.
     * Key: jobId (String UUID), Value: completed PlanResponse or null (still running).
     * A missing key means the job was never started; null value means running.
     * Eviction is handled opportunistically — entries are small and short-lived.
     */
    private final ConcurrentHashMap<String, PlanResponse> asyncResultCache = new ConcurrentHashMap<>();
    /** Tracks jobs that failed so getPlanResult can distinguish "still running" from "failed". */
    private final ConcurrentHashMap<String, JobStatus> asyncStatusCache = new ConcurrentHashMap<>();

    // ════════════════════════════════════════════════════════════════════════
    // DTO-based API (used by ApplicationPlannerController)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * B2-G3 / B3: Synchronous plan generation via DTO (controller-facing).
     * Delegates to the core generatePlan(UUID, UUID) method.
     */
    public PlanResponse generatePlan(UUID userId, PlanRequest request) {
        List<ApplicationTask> tasks = generatePlan(request.getUserJobId(), userId);
        return toPlanResponse(request.getUserJobId(), tasks);
    }

    /**
     * B2-G3 / B3: Async plan generation via DTO (controller-facing).
     * Stores the result in asyncResultCache when complete.
     * Returns immediately — the controller should respond with 202 Accepted.
     */
    @Async("skillExecutor")
    public CompletableFuture<PlanResponse> generatePlanAsync(
            UUID userId, PlanRequest request, String jobId) {

        asyncStatusCache.put(jobId, JobStatus.PENDING);
        log.info("[PlannerAsync] Starting background plan jobId={} userJobId={} userId={}",
                jobId, request.getUserJobId(), userId);
        try {
            List<ApplicationTask> tasks = generatePlan(request.getUserJobId(), userId);
            PlanResponse response = toPlanResponse(request.getUserJobId(), tasks);
            asyncResultCache.put(jobId, response);
            asyncStatusCache.put(jobId, JobStatus.COMPLETED);
            pushNotification(userId, request.getUserJobId(), "PLANNER_READY",
                    "Your application plan is ready!",
                    "AI has generated " + tasks.size() + " action items for your application.");
            log.info("[PlannerAsync] Complete jobId={} — {} tasks", jobId, tasks.size());
            return CompletableFuture.completedFuture(response);
        } catch (Exception e) {
            asyncStatusCache.put(jobId, JobStatus.FAILED);
            log.error("[PlannerAsync] Failed jobId={}: {}", jobId, e.getMessage());
            pushNotification(userId, request.getUserJobId(), "PLANNER_FAILED",
                    "Application plan could not be generated",
                    "Please try again. Error: " + e.getMessage());
            return CompletableFuture.failedFuture(e);
        }
    }

    /**
     * B2-G3: Poll for an async plan result.
     * Returns null if still running, the PlanResponse if done.
     * Throws ApiException.notFound if the jobId is unknown.
     */
    public PlanResponse getPlanResult(String jobId, UUID userId) {
        if (!asyncStatusCache.containsKey(jobId)) {
            throw ApiException.notFound("Plan job not found: " + jobId);
        }
        JobStatus status = asyncStatusCache.get(jobId);
        if (status == JobStatus.FAILED) {
            throw ApiException.internalError("Plan generation failed for jobId=" + jobId
                    + ". Please submit a new request.");
        }
        // PENDING or result not yet stored — return null → controller sends 202
        return asyncResultCache.get(jobId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Legacy async entry point (kept for backward compat — e.g. direct callers)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Legacy async variant (userJobId + userId directly).
     * Still used by any internal callers that haven't migrated to the DTO path.
     */
    @Async("skillExecutor")
    public CompletableFuture<List<ApplicationTask>> generatePlanAsync(UUID userJobId, UUID userId) {
        log.info("[PlannerAsync] Starting background plan generation for userJobId={} userId={}",
                userJobId, userId);
        try {
            List<ApplicationTask> tasks = generatePlan(userJobId, userId);
            pushNotification(userId, userJobId, "PLANNER_READY",
                    "Your application plan is ready!",
                    "AI has generated " + tasks.size() + " action items for your application.");
            log.info("[PlannerAsync] Complete for userJobId={} — {} tasks", userJobId, tasks.size());
            return CompletableFuture.completedFuture(tasks);
        } catch (Exception e) {
            log.error("[PlannerAsync] Failed for userJobId={}: {}", userJobId, e.getMessage());
            pushNotification(userId, userJobId, "PLANNER_FAILED",
                    "Application plan could not be generated",
                    "Please try again. Error: " + e.getMessage());
            return CompletableFuture.failedFuture(e);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Core synchronous plan generation (primary business logic)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Task 22 — Auto-generates a set of next-action tasks for the given job.
     * Clears auto-generated tasks and replaces them with fresh AI-derived plan.
     * Synchronous version — used internally and by tests.
     */
    public List<ApplicationTask> generatePlan(UUID userJobId, UUID userId) {
        UserJob userJob = userJobRepo.findById(userJobId)
                .orElseThrow(() -> ApiException.notFound("UserJob not found: " + userJobId));

        if (!userJob.getUserId().equals(userId)) {
            throw ApiException.forbidden("Access denied to userJob: " + userJobId);
        }

        Job job = jobRepo.findById(userJob.getJobId())
                .orElseThrow(() -> ApiException.notFound("Job not found: " + userJob.getJobId()));

        // Delete existing auto-generated tasks for this job
        List<ApplicationTask> existing = taskRepo.findByUserJobIdOrderByDueDateAsc(userJobId);
        existing.stream().filter(ApplicationTask::isAutoGenerated).forEach(taskRepo::delete);

        String jobTitle = job.getTitle() != null ? job.getTitle() : "this role";
        String company  = job.getCompany() != null ? job.getCompany() : "the company";
        String stage    = userJob.getStatus() != null ? userJob.getStatus() : "SAVED";

        String prompt = String.format(
            """
            You are a career planning assistant. Generate a list of next actions for a job application.
            Role: %s at %s. Current stage: %s.
            Produce 5 to 7 prioritised action items. For each item provide:
            - title (max 80 chars)
            - description (1-2 sentences)
            - taskType (one of: ACTION, FOLLOW_UP, PREP, REVIEW, SUBMIT)
            - priority (one of: LOW, MEDIUM, HIGH, URGENT)
            - daysFromNow (integer, how many days from today the task should be due)
            Return as JSON array: [{"title":"","description":"","taskType":"","priority":"","daysFromNow":0}]""",
            jobTitle, company, stage
        );

        long startMs = System.currentTimeMillis();
        String aiResponse;
        try {
            aiResponse = geminiService.generateContent(prompt, userId, "application-plan");
            aiMetrics.recordSuccess("gemini", System.currentTimeMillis() - startMs);
        } catch (Exception e) {
            aiMetrics.recordFailure("gemini");
            log.warn("[Planner] Gemini failed, creating default tasks: {}", e.getMessage());
            return createDefaultTasks(userJobId, userId, jobTitle, company);
        }

        List<ApplicationTask> created = new ArrayList<>();

        try {
            String[] blocks = aiResponse.split("\\},\\s*\\{");
            for (String block : blocks) {
                ApplicationTask task = new ApplicationTask();
                task.setId(UUID.randomUUID());
                task.setUserJobId(userJobId);
                task.setUserId(userId);
                task.setAutoGenerated(true);
                task.setStatus("PENDING");
                task.setTitle(extractField(block, "title", "Action item"));
                task.setDescription(extractField(block, "description", ""));
                task.setTaskType(extractField(block, "taskType", "ACTION"));
                task.setPriority(extractField(block, "priority", "MEDIUM"));

                int days = extractInt(block, "daysFromNow", 3);
                task.setDueDate(Instant.now().plus(java.time.Duration.ofDays(days)));
                created.add(taskRepo.save(task));
            }
        } catch (Exception e) {
            log.warn("Could not parse AI plan response, creating a default task set: {}", e.getMessage());
            created.addAll(createDefaultTasks(userJobId, userId, jobTitle, company));
        }

        log.info("Generated {} planner tasks for userJobId={}", created.size(), userJobId);
        return created;
    }

    /** Task 23 — Mark a task complete */
    public ApplicationTask markComplete(UUID taskId, UUID userId) {
        ApplicationTask task = taskRepo.findById(taskId)
                .orElseThrow(() -> ApiException.notFound("Task not found: " + taskId));
        if (!task.getUserId().equals(userId)) {
            throw ApiException.forbidden("Access denied to task: " + taskId);
        }
        task.setStatus("COMPLETED");
        task.setCompletedAt(Instant.now());
        return taskRepo.save(task);
    }

    /** Task 24 — Get upcoming tasks within 14 days for the user */
    public List<ApplicationTask> getUpcoming(UUID userId) {
        return taskRepo.findUpcomingByUser(
                userId,
                Instant.now().minus(java.time.Duration.ofDays(30)),
                Instant.now().plus(java.time.Duration.ofDays(14))
        );
    }

    public List<ApplicationTask> getTasksForJob(UUID userJobId, UUID userId) {
        UserJob userJob = userJobRepo.findById(userJobId)
                .orElseThrow(() -> ApiException.notFound("UserJob not found"));
        if (!userJob.getUserId().equals(userId)) {
            throw ApiException.notFound("UserJob not found");
        }
        return taskRepo.findByUserJobIdOrderByDueDateAsc(userJobId);
    }

    public List<DeadlineEvent> getDeadlinesForJob(UUID userJobId, UUID userId) {
        UserJob userJob = userJobRepo.findById(userJobId)
                .orElseThrow(() -> ApiException.notFound("UserJob not found"));
        if (!userJob.getUserId().equals(userId)) {
            throw ApiException.notFound("UserJob not found");
        }
        return deadlineRepo.findByUserJobIdOrderByEventDateAsc(userJobId);
    }

    public List<DeadlineEvent> getUpcomingDeadlines(UUID userId) {
        return deadlineRepo.findByUserIdAndEventDateBetweenOrderByEventDateAsc(
                userId, Instant.now(), Instant.now().plus(java.time.Duration.ofDays(30)));
    }

    public DeadlineEvent addDeadline(UUID userJobId, UUID userId, String type, String title,
                                     Instant eventDate, String notes) {
        UserJob userJob = userJobRepo.findById(userJobId)
                .orElseThrow(() -> ApiException.notFound("UserJob not found"));
        if (!userJob.getUserId().equals(userId)) {
            throw ApiException.forbidden("Access denied to user job");
        }
        DeadlineEvent event = new DeadlineEvent();
        event.setId(UUID.randomUUID());
        event.setUserJobId(userJobId);
        event.setUserId(userId);
        event.setEventType(type);
        event.setTitle(title);
        event.setEventDate(eventDate);
        event.setNotes(notes);
        return deadlineRepo.save(event);
    }

    /** Task 30 — Create overdue notification for a task */
    public void notifyOverdue(ApplicationTask task) {
        Notification n = new Notification();
        n.setId(UUID.randomUUID());
        n.setUserId(task.getUserId());
        n.setType(Notification.TYPE_OVERDUE_TASK);
        n.setTitle("Overdue task!");
        n.setBody("\"" + task.getTitle() + "\" is overdue. Take action now.");
        n.setRead(false);
        n.setCreatedAt(Instant.now());
        n.setEntityType("application_task");
        n.setEntityId(task.getId());
        notificationRepo.save(n);

        task.setReminderSent(true);
        taskRepo.save(task);
    }

    // ════════════════════════════════════════════════════════════════════════
    // DTO mapping helpers
    // ════════════════════════════════════════════════════════════════════════

    /** Convert a list of ApplicationTask entities to a PlanResponse DTO. */
    private PlanResponse toPlanResponse(UUID userJobId, List<ApplicationTask> tasks) {
        List<TaskItem> items = tasks.stream()
                .map(t -> TaskItem.builder()
                        .id(t.getId())
                        .title(t.getTitle())
                        .description(t.getDescription())
                        .taskType(t.getTaskType())
                        .priority(t.getPriority())
                        .status(t.getStatus())
                        .dueDate(t.getDueDate())
                        .autoGenerated(t.isAutoGenerated())
                        .build())
                .collect(Collectors.toList());
        return PlanResponse.builder()
                .userJobId(userJobId)
                .tasks(items)
                .taskCount(items.size())
                .generatedAt(Instant.now())
                .build();
    }

    public com.careerops.dto.PlannerDTO.TaskResponse toTaskResponse(ApplicationTask t) {
        return com.careerops.dto.PlannerDTO.TaskResponse.builder()
                .id(t.getId())
                .userJobId(t.getUserJobId())
                .title(t.getTitle())
                .description(t.getDescription())
                .taskType(t.getTaskType())
                .priority(t.getPriority())
                .status(t.getStatus())
                .dueDate(t.getDueDate())
                .completedAt(t.getCompletedAt())
                .autoGenerated(t.isAutoGenerated())
                .createdAt(t.getCreatedAt())
                .build();
    }

    public com.careerops.dto.PlannerDTO.DeadlineResponse toDeadlineResponse(DeadlineEvent e) {
        return com.careerops.dto.PlannerDTO.DeadlineResponse.builder()
                .id(e.getId())
                .userJobId(e.getUserJobId())
                .eventType(e.getEventType())
                .title(e.getTitle())
                .eventDate(e.getEventDate())
                .notes(e.getNotes())
                .createdAt(e.getCreatedAt())
                .build();
    }

    // ════════════════════════════════════════════════════════════════════════
    // Notification helper
    // ════════════════════════════════════════════════════════════════════════

    private void pushNotification(UUID userId, UUID userJobId, String type, String title, String body) {
        try {
            Notification n = new Notification();
            n.setId(UUID.randomUUID());
            n.setUserId(userId);
            n.setType(type);
            n.setTitle(title);
            n.setBody(body);
            n.setRead(false);
            n.setCreatedAt(Instant.now());
            n.setEntityType("user_job");
            n.setEntityId(userJobId);
            notificationRepo.save(n);
        } catch (Exception e) {
            log.warn("[Planner] Could not push notification type={}: {}", type, e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Private helpers
    // ════════════════════════════════════════════════════════════════════════

    private List<ApplicationTask> createDefaultTasks(UUID userJobId, UUID userId,
                                                      String jobTitle, String company) {
        String[][] defaults = {
            {"Tailor your CV for " + jobTitle, "Align skills and bullet points to match the job description.", "REVIEW", "HIGH", "1"},
            {"Write cover letter for " + company, "Draft and review a personalised cover letter.", "ACTION", "HIGH", "2"},
            {"Research " + company, "Review company culture, recent news, and values.", "PREP", "MEDIUM", "2"},
            {"Submit application", "Double-check all materials and submit.", "SUBMIT", "URGENT", "3"},
            {"Follow up if no response in 7 days", "Send a polite follow-up email to the recruiter.", "FOLLOW_UP", "MEDIUM", "10"}
        };
        List<ApplicationTask> created = new ArrayList<>();
        for (String[] d : defaults) {
            ApplicationTask t = new ApplicationTask();
            t.setId(UUID.randomUUID());
            t.setUserJobId(userJobId);
            t.setUserId(userId);
            t.setTitle(d[0]);
            t.setDescription(d[1]);
            t.setTaskType(d[2]);
            t.setPriority(d[3]);
            t.setStatus("PENDING");
            t.setAutoGenerated(true);
            t.setDueDate(Instant.now().plus(java.time.Duration.ofDays(Long.parseLong(d[4]))));
            created.add(taskRepo.save(t));
        }
        return created;
    }

    private String extractField(String block, String key, String fallback) {
        try {
            String marker = "\"" + key + "\":\"";
            int start = block.indexOf(marker);
            if (start < 0) return fallback;
            int valueStart = start + marker.length();
            int valueEnd = block.indexOf("\"", valueStart);
            return valueEnd > valueStart ? block.substring(valueStart, valueEnd) : fallback;
        } catch (Exception e) { return fallback; }
    }

    private int extractInt(String block, String key, int fallback) {
        try {
            String marker = "\"" + key + "\":";
            int start = block.indexOf(marker);
            if (start < 0) return fallback;
            int valueStart = start + marker.length();
            StringBuilder num = new StringBuilder();
            for (int i = valueStart; i < block.length(); i++) {
                char c = block.charAt(i);
                if (Character.isDigit(c)) num.append(c);
                else if (num.length() > 0) break;
            }
            return num.length() > 0 ? Integer.parseInt(num.toString()) : fallback;
        } catch (Exception e) { return fallback; }
    }
}
