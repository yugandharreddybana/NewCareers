package com.careerops.controller;

import com.careerops.model.ApplicationTask;
import com.careerops.model.DeadlineEvent;
import com.careerops.service.ApplicationPlannerService;
import com.careerops.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/planner")
@RequiredArgsConstructor
public class PlannerController {

    private final ApplicationPlannerService plannerService;
    private final JwtService jwtService;

    // ── GET /api/planner/upcoming ──────────────────────────────────────────────
    // Returns pending tasks + upcoming deadlines (14-day window) + overdue tasks
    @GetMapping("/upcoming")
    public ResponseEntity<Map<String, Object>> getUpcoming(HttpServletRequest request) {
        UUID userId = extractUserId(request);
        return ResponseEntity.ok(plannerService.getUpcoming(userId));
    }

    // ── GET /api/planner/jobs/{userJobId}/tasks ────────────────────────────────
    @GetMapping("/jobs/{userJobId}/tasks")
    public ResponseEntity<List<ApplicationTask>> getTasksForJob(
            @PathVariable UUID userJobId) {
        return ResponseEntity.ok(plannerService.getTasksForJob(userJobId));
    }

    // ── POST /api/planner/jobs/{userJobId}/tasks/generate ─────────────────────
    // Auto-generate stage-aware tasks for a tracked job
    @PostMapping("/jobs/{userJobId}/tasks/generate")
    public ResponseEntity<List<ApplicationTask>> generateTasks(
            @PathVariable UUID userJobId,
            HttpServletRequest request) {
        UUID userId = extractUserId(request);
        return ResponseEntity.ok(plannerService.generatePlan(userJobId, userId));
    }

    // ── PATCH /api/planner/tasks/{taskId}/complete ────────────────────────────
    @PatchMapping("/tasks/{taskId}/complete")
    public ResponseEntity<ApplicationTask> completeTask(
            @PathVariable UUID taskId,
            HttpServletRequest request) {
        UUID userId = extractUserId(request);
        return ResponseEntity.ok(plannerService.markComplete(taskId, userId));
    }

    // ── GET /api/planner/jobs/{userJobId}/deadlines ───────────────────────────
    @GetMapping("/jobs/{userJobId}/deadlines")
    public ResponseEntity<List<DeadlineEvent>> getDeadlines(
            @PathVariable UUID userJobId) {
        return ResponseEntity.ok(plannerService.getDeadlinesForJob(userJobId));
    }

    // ── POST /api/planner/jobs/{userJobId}/deadlines ──────────────────────────
    @PostMapping("/jobs/{userJobId}/deadlines")
    public ResponseEntity<DeadlineEvent> createDeadline(
            @PathVariable UUID userJobId,
            @RequestBody CreateDeadlineRequest body,
            HttpServletRequest request) {
        UUID userId = extractUserId(request);
        DeadlineEvent event = plannerService.addDeadline(
            userJobId, userId,
            body.eventType(), body.title(),
            body.eventDate() != null ? body.eventDate().toLocalDateTime() : null,
            body.notes()
        );
        return ResponseEntity.ok(event);
    }

    // ── Private helpers ───────────────────────────────────────────────────────
    private UUID extractUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer "))
            throw new SecurityException("Missing or invalid Authorization header");
        String token = authHeader.substring(7);
        String userIdStr = jwtService.extractUserId(token);
        return UUID.fromString(userIdStr);
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
