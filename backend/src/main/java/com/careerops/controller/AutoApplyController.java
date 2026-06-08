package com.careerops.controller;

import com.careerops.annotation.PlanGated;
import com.careerops.dto.AutoApplyDtos.*;
import com.careerops.service.ApplicationAutomationService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/applications/auto")
@io.micrometer.core.annotation.Timed
public class AutoApplyController {

    private final ApplicationAutomationService service;

    public AutoApplyController(ApplicationAutomationService service) {
        this.service = service;
    }

    // ── Answer bank ──────────────────────────────────────────────────────────

    @GetMapping("/answers")
    public List<AnswerBankEntry> listAnswers() {
        return service.listAnswers(AuthUtil.currentUserId());
    }

    @PostMapping("/answers")
    public AnswerBankEntry upsertAnswer(@RequestBody UpsertAnswerRequest req) {
        return service.upsertAnswer(AuthUtil.currentUserId(), req);
    }

    @DeleteMapping("/answers/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAnswer(@PathVariable UUID id) {
        service.deleteAnswer(AuthUtil.currentUserId(), id);
    }

    // ── Application runs ─────────────────────────────────────────────────────

    @GetMapping("/history")
    public RunListResponse listRuns() {
        return service.listRuns(AuthUtil.currentUserId());
    }

    @GetMapping("/status/{runId}")
    public ApplicationRunResponse getStatus(@PathVariable UUID runId) {
        return service.getRunDetail(AuthUtil.currentUserId(), runId);
    }

    @PostMapping("/start/{userJobId}")
    @ResponseStatus(HttpStatus.CREATED)
    @PlanGated("job_application")
    public ApplicationRunResponse startRun(
            @PathVariable UUID userJobId,
            @RequestBody(required = false) StartRunRequest req) {
        return service.startRun(AuthUtil.currentUserId(), userJobId, req);
    }

    @PostMapping("/approve/{runId}")
    public ApplicationRunResponse approveRun(@PathVariable UUID runId,
                                             @RequestBody ApproveRunRequest req) {
        return service.approveRun(AuthUtil.currentUserId(), runId, req);
    }

    @PostMapping("/retry/{runId}")
    public ApplicationRunResponse retryRun(@PathVariable UUID runId) {
        return service.retryRun(AuthUtil.currentUserId(), runId);
    }
}
