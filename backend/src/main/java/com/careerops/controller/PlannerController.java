package com.careerops.controller;

import com.careerops.model.ApplicationTask;
import com.careerops.model.DeadlineEvent;
import com.careerops.service.ApplicationPlannerService;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/planner")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class PlannerController {

    private final ApplicationPlannerService plannerService;
    private final com.careerops.service.ProgressInsightService progressService;

    @GetMapping("/upcoming")
    public com.careerops.dto.PlannerDTO.UpcomingResponse getUpcoming() {
        UUID userId = AuthUtil.currentUserId();
        List<ApplicationTask> tasks = plannerService.getUpcoming(userId);
        List<com.careerops.dto.PlannerDTO.TaskResponse> pending = new ArrayList<>();
        List<com.careerops.dto.PlannerDTO.TaskResponse> overdue = new ArrayList<>();

        for (ApplicationTask t : tasks) {
            if ("COMPLETED".equalsIgnoreCase(t.getStatus())) {
                continue;
            }
            if (t.getDueDate() != null && t.getDueDate().isBefore(java.time.Instant.now())) {
                overdue.add(plannerService.toTaskResponse(t));
            } else {
                pending.add(plannerService.toTaskResponse(t));
            }
        }

        List<com.careerops.dto.PlannerDTO.DeadlineResponse> upcomingEvents = plannerService.getUpcomingDeadlines(userId)
                .stream().map(plannerService::toDeadlineResponse).toList();

        return com.careerops.dto.PlannerDTO.UpcomingResponse.builder()
                .pendingTasks(pending)
                .overdueTasks(overdue)
                .upcomingEvents(upcomingEvents)
                .build();
    }

    // ── GET /api/planner/jobs/{userJobId}/tasks ────────────────────────────────
    @GetMapping("/jobs/{userJobId}/tasks")
    public List<com.careerops.dto.PlannerDTO.TaskResponse> getTasksForJob(
            @PathVariable UUID userJobId) {
        UUID userId = AuthUtil.currentUserId();
        return plannerService.getTasksForJob(userJobId, userId).stream()
                .map(plannerService::toTaskResponse).toList();
    }

    // ── POST /api/planner/jobs/{userJobId}/tasks/generate ─────────────────────
    @PostMapping("/jobs/{userJobId}/tasks/generate")
    public List<com.careerops.dto.PlannerDTO.TaskResponse> generateTasks(
            @PathVariable UUID userJobId) {
        UUID userId = AuthUtil.currentUserId();
        return plannerService.generatePlan(userJobId, userId).stream()
                .map(plannerService::toTaskResponse).toList();
    }

    // ── PATCH /api/planner/tasks/{taskId}/complete ────────────────────────────
    @PatchMapping("/tasks/{taskId}/complete")
    public com.careerops.dto.PlannerDTO.TaskCompletionResponse completeTask(
            @PathVariable UUID taskId) {
        UUID userId = AuthUtil.currentUserId();
        var task = plannerService.toTaskResponse(plannerService.markComplete(taskId, userId));
        var streak = progressService.recordDailyActivity(userId);
        
        return com.careerops.dto.PlannerDTO.TaskCompletionResponse.builder()
                .task(task)
                .streak(streak)
                .build();
    }

    // ── GET /api/planner/jobs/{userJobId}/deadlines ───────────────────────────
    @GetMapping("/jobs/{userJobId}/deadlines")
    public List<com.careerops.dto.PlannerDTO.DeadlineResponse> getDeadlines(
            @PathVariable UUID userJobId) {
        UUID userId = AuthUtil.currentUserId();
        return plannerService.getDeadlinesForJob(userJobId, userId).stream()
                .map(plannerService::toDeadlineResponse).toList();
    }

    // ── POST /api/planner/jobs/{userJobId}/deadlines ──────────────────────────
    @PostMapping("/jobs/{userJobId}/deadlines")
    public com.careerops.dto.PlannerDTO.DeadlineResponse createDeadline(
            @PathVariable UUID userJobId,
            @RequestBody CreateDeadlineRequest body) {
        UUID userId = AuthUtil.currentUserId();
        DeadlineEvent event = plannerService.addDeadline(
            userJobId, userId,
            body.eventType(), body.title(),
            body.eventDate() != null ? body.eventDate().toInstant() : null,
            body.notes()
        );
        return plannerService.toDeadlineResponse(event);
    }

    // ── Inner record for request body ─────────────────────────────────────────
    public record CreateDeadlineRequest(
        String eventType,
        String title,
        String notes,
        OffsetDateTime eventDate,
        OffsetDateTime remindAt
    ) {}
}
