package com.careerops.controller;

import com.careerops.dto.ApplicationPlannerDtos.PlanRequest;
import com.careerops.dto.ApplicationPlannerDtos.PlanResponse;
import com.careerops.service.ApplicationPlannerService;
import com.careerops.util.AuthUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.UUID;

/**
 * Application Planner Controller
 *
 * B2-G3 FIX: The synchronous generatePlan() endpoint blocks the HTTP thread
 * for the full duration of a Gemini/Claude call (up to 60+ seconds).
 * Fixed by:
 *   POST /plan          → sync (kept for backward compat)
 *   POST /plan/async    → 202 Accepted + X-Plan-Job-Id header (B2-G3)
 *   GET  /plan/result/{jobId} → poll for result
 */
@RestController
@RequestMapping("/api/v1/planner")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Application Planner", description = "AI-powered application strategy planner")
public class ApplicationPlannerController {

    private final ApplicationPlannerService plannerService;

    // ── Synchronous endpoint (backward-compatible) ──────────────────────────

    @PostMapping("/plan")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Generate application plan (synchronous)",
               description = "Blocking call — use /plan/async for long-running plans to avoid gateway timeouts.")
    public ResponseEntity<PlanResponse> generatePlan(
            @Valid @RequestBody PlanRequest request) {
        UUID userId = AuthUtil.currentUserId();
        log.info("[Planner] Sync plan request userId={}", userId);
        PlanResponse plan = plannerService.generatePlan(userId, request);
        return ResponseEntity.ok(plan);
    }

    // ── Async endpoint (B2-G3 fix) ──────────────────────────────────────────

    /**
     * Triggers async plan generation on the skillExecutor thread pool.
     * Returns 202 Accepted immediately with X-Plan-Job-Id header.
     * Poll GET /plan/result/{jobId} for the final result.
     */
    @PostMapping("/plan/async")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Generate application plan (async, non-blocking)",
               description = "Returns 202 immediately. Poll GET /plan/result/{jobId} for the result.")
    public ResponseEntity<Void> generatePlanAsync(
            @Valid @RequestBody PlanRequest request) {
        UUID   userId = AuthUtil.currentUserId();
        String jobId  = UUID.randomUUID().toString();
        log.info("[Planner] Async plan request userId={} jobId={}", userId, jobId);
        plannerService.generatePlanAsync(userId, request, jobId);
        return ResponseEntity.accepted()
                .header("X-Plan-Job-Id", jobId)
                .build();
    }

    /**
     * Poll for an async plan result.
     * Returns 200 + body when complete, 202 while still running.
     */
    @GetMapping("/plan/result/{jobId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Poll async plan result")
    public ResponseEntity<PlanResponse> getPlanResult(@PathVariable String jobId) {
        UUID         userId = AuthUtil.currentUserId();
        PlanResponse result = plannerService.getPlanResult(jobId, userId);
        if (result == null) {
            return ResponseEntity.accepted().build();
        }
        return ResponseEntity.ok(result);
    }
}
