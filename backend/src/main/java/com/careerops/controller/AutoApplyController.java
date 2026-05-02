package com.careerops.controller;

import com.careerops.dto.AutoApplyDtos.*;
import com.careerops.service.ApplicationAutomationService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/applications/auto")
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
    public ResponseEntity<Void> deleteAnswer(@PathVariable UUID id) {
        service.deleteAnswer(AuthUtil.currentUserId(), id);
        return ResponseEntity.noContent().build();
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
    public ResponseEntity<ApplicationRunResponse> startRun(
            @PathVariable UUID userJobId,
            @RequestBody(required = false) StartRunRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.startRun(AuthUtil.currentUserId(), userJobId, req));
    }

    @PostMapping("/approve/{runId}")
    public ApplicationRunResponse approveRun(@PathVariable UUID runId,
                                             @RequestBody ApproveRunRequest req) {
        return service.approveRun(AuthUtil.currentUserId(), runId, req);
    }
}
