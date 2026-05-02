package com.careerops.controller;

import com.careerops.model.ApplicationTask;
import com.careerops.model.DeadlineEvent;
import com.careerops.service.ApplicationPlannerService;
import com.careerops.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tasks 22-24 — Planner endpoints.
 * POST   /api/planner/generate/:userJobId
 * PATCH  /api/planner/task/:taskId
 * GET    /api/planner/upcoming
 * GET    /api/planner/tasks/:userJobId
 * GET    /api/planner/deadlines/:userJobId
 * POST   /api/planner/deadlines/:userJobId
 * GET    /api/planner/deadlines/upcoming
 */
@RestController
@RequestMapping("/api/planner")
@RequiredArgsConstructor
public class ApplicationPlannerController {

    private final ApplicationPlannerService plannerService;
    private final JwtUtil jwtUtil;

    /** Task 22 — Generate AI plan for a job */
    @PostMapping("/generate/{userJobId}")
    public ResponseEntity<List<ApplicationTask>> generate(
            @PathVariable UUID userJobId,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        return ResponseEntity.ok(plannerService.generatePlan(userJobId, userId));
    }

    /** Task 23 — Mark a task complete */
    @PatchMapping("/task/{taskId}")
    public ResponseEntity<ApplicationTask> updateTask(
            @PathVariable UUID taskId,
            @RequestBody Map<String, String> body,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        // Currently supports marking complete; extend to full PATCH as needed
        ApplicationTask updated = plannerService.markComplete(taskId, userId);
        return ResponseEntity.ok(updated);
    }

    /** Task 24 — Get upcoming tasks (next 14 days) across all jobs */
    @GetMapping("/upcoming")
    public ResponseEntity<List<ApplicationTask>> upcoming(HttpServletRequest req) {
        UUID userId = extractUserId(req);
        return ResponseEntity.ok(plannerService.getUpcoming(userId));
    }

    /** Get all tasks for a specific job */
    @GetMapping("/tasks/{userJobId}")
    public ResponseEntity<List<ApplicationTask>> tasksForJob(
            @PathVariable UUID userJobId,
            HttpServletRequest req) {
        extractUserId(req);
        return ResponseEntity.ok(plannerService.getTasksForJob(userJobId));
    }

    /** Get deadlines for a specific job */
    @GetMapping("/deadlines/{userJobId}")
    public ResponseEntity<List<DeadlineEvent>> deadlinesForJob(
            @PathVariable UUID userJobId,
            HttpServletRequest req) {
        extractUserId(req);
        return ResponseEntity.ok(plannerService.getDeadlinesForJob(userJobId));
    }

    /** Add a deadline event to a job */
    @PostMapping("/deadlines/{userJobId}")
    public ResponseEntity<DeadlineEvent> addDeadline(
            @PathVariable UUID userJobId,
            @RequestBody Map<String, String> body,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        return ResponseEntity.ok(plannerService.addDeadline(
                userJobId, userId,
                body.getOrDefault("eventType", "CUSTOM"),
                body.getOrDefault("title", "Event"),
                LocalDateTime.parse(body.get("eventDate")),
                body.getOrDefault("notes", "")
        ));
    }

    /** Get upcoming deadlines (next 30 days) across all jobs */
    @GetMapping("/deadlines/upcoming")
    public ResponseEntity<List<DeadlineEvent>> upcomingDeadlines(HttpServletRequest req) {
        UUID userId = extractUserId(req);
        return ResponseEntity.ok(plannerService.getUpcomingDeadlines(userId));
    }

    private UUID extractUserId(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            throw new SecurityException("Missing or invalid Authorization header");
        }
        return UUID.fromString(jwtUtil.extractUserId(header.substring(7)));
    }
}
