package com.careerops.service;

import com.careerops.dto.AutoApplyDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.AnswerBank;
import com.careerops.model.ApplicationRun;
import com.careerops.model.ApplicationRunStep;
import com.careerops.repository.AnswerBankRepository;
import com.careerops.repository.ApplicationRunRepository;
import com.careerops.repository.ApplicationRunStepRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ApplicationAutomationService {

    private final ApplicationRunRepository runRepo;
    private final ApplicationRunStepRepository stepRepo;
    private final AnswerBankRepository answerBankRepo;
    private final com.careerops.repository.FeatureFlagRepository flagRepo; // 3.053
    private final AuditLogService audit;

    public ApplicationAutomationService(ApplicationRunRepository runRepo,
                                        ApplicationRunStepRepository stepRepo,
                                        AnswerBankRepository answerBankRepo,
                                        com.careerops.repository.FeatureFlagRepository flagRepo,
                                        AuditLogService audit) {
        this.runRepo        = runRepo;
        this.stepRepo       = stepRepo;
        this.answerBankRepo = answerBankRepo;
        this.flagRepo       = flagRepo;
        this.audit          = audit;
    }

    // ── Answer bank ──────────────────────────────────────────────────────────

    @Transactional(timeout = 10, readOnly = true)
    public List<AnswerBankEntry> listAnswers(UUID userId) {
        return answerBankRepo.findByUserIdOrderByQuestionKeyAsc(userId)
            .stream().map(this::toAnswerEntry).toList();
    }

    @Transactional(timeout = 10)
    public AnswerBankEntry upsertAnswer(UUID userId, UpsertAnswerRequest req) {
        AnswerBank a = answerBankRepo.findByUserIdAndQuestionKey(userId, req.questionKey())
            .orElseGet(() -> AnswerBank.builder()
                .userId(userId)
                .questionKey(req.questionKey())
                .build());
        a.setAnswerText(req.answerText());
        return toAnswerEntry(answerBankRepo.save(a));
    }

    @Transactional(timeout = 10)
    public void deleteAnswer(UUID userId, UUID id) {
        AnswerBank a = answerBankRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Answer not found"));
        answerBankRepo.delete(a);
    }

    // ── Application runs ─────────────────────────────────────────────────────

    @Transactional(timeout = 10, readOnly = true)
    public RunListResponse listRuns(UUID userId) {
        List<ApplicationRunResponse> items = runRepo
            .findByUserIdOrderByCreatedAtDesc(userId)
            .stream().map(r -> toRunResponse(r, false)).toList();
        return new RunListResponse(items, items.size());
    }

    @Transactional(timeout = 10, readOnly = true)
    public ApplicationRunResponse getRunDetail(UUID userId, UUID runId) {
        ApplicationRun run = findRun(userId, runId);
        return toRunResponse(run, true);
    }

    @Transactional(timeout = 10)
    public ApplicationRunResponse startRun(UUID userId, UUID userJobId, StartRunRequest req) {
        // 3.053 — Check feature flag
        boolean enabled = flagRepo.findByFlagKey("auto_apply_enabled")
            .map(com.careerops.model.FeatureFlag::getEnabled)
            .orElse(false);
        if (!enabled) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Auto-apply feature is currently disabled for maintenance");
        }

        // 3.054 — Simple synchronization to prevent race condition on double-click
        synchronized ( (userId.toString() + userJobId.toString()).intern() ) {
            if (runRepo.existsByUserIdAndUserJobIdAndStatusIn(userId, userJobId, List.of(com.careerops.model.ApplicationRunStatus.in_progress, com.careerops.model.ApplicationRunStatus.awaiting_approval))) {
                throw new ApiException(HttpStatus.CONFLICT, "An application run is already active for this job");
            }

            // Build the standard 5-step flow
            ApplicationRun run = ApplicationRun.builder()
                .userId(userId)
                .userJobId(userJobId)
                .status(com.careerops.model.ApplicationRunStatus.in_progress)
                .totalSteps((short) 5)
                .completedSteps((short) 0)
                .resumeVersionId(req != null ? req.resumeVersionId() : null)
                .build();
            run = runRepo.save(run);

            audit.log(userId, "AUTO_APPLY_START", java.util.Map.of(
                "userJobId", userJobId.toString(),
                "runId", run.getId().toString()
            ));

            List<Object[]> stepDefs = List.of(
                new Object[]{ 1, "prefill",         "(SIMULATED) Pre-fill contact and personal details" },
                new Object[]{ 2, "cv_upload",        "(SIMULATED) Upload selected resume version" },
                new Object[]{ 3, "answer_question",  "(SIMULATED) Answer application questions from your answer bank" },
                new Object[]{ 4, "approval_gate",    "Review everything before submit" },
                new Object[]{ 5, "submit",           "(SIMULATED) Submit application" }
            );

            final UUID runId = run.getId();
            List<ApplicationRunStep> steps = stepDefs.stream().map(d -> ApplicationRunStep.builder()
                .runId(runId)
                .userId(userId)
                .stepNumber(((Integer) d[0]).shortValue())
                .stepType((String) d[1])
                .description((String) d[2])
                .status((Integer) d[0] == 1 ? "in_progress" : "pending")
                .build()
            ).toList();
            stepRepo.saveAll(steps);

            // Auto-complete steps 1–3 (simulated)
            List<ApplicationRunStep> saved = stepRepo.findByRunIdOrderByStepNumberAsc(runId);
            for (ApplicationRunStep s : saved) {
                if (s.getStepNumber() <= 3) {
                    s.setStatus("completed");
                    s.setExecutedAt(Instant.now());
                } else if (s.getStepNumber() == 4) {
                    s.setStatus("in_progress"); // awaiting user approval
                }
            }
            stepRepo.saveAll(saved);
            run.setCompletedSteps((short) 3);
            run.setStatus(com.careerops.model.ApplicationRunStatus.awaiting_approval);
            run = runRepo.save(run);

            return toRunResponse(run, true);
        }
    }

    @Transactional(timeout = 10)
    public ApplicationRunResponse approveRun(UUID userId, UUID runId, ApproveRunRequest req) {
        ApplicationRun run = findRun(userId, runId);
        if (run.getStatus() != com.careerops.model.ApplicationRunStatus.awaiting_approval) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Run is not awaiting approval");
        }
        if (!req.approved()) {
            run.setStatus(com.careerops.model.ApplicationRunStatus.cancelled);
            return toRunResponse(runRepo.save(run), true);
        }

        // 2.066 — Verify run state hash
        String currentHash = calculateHash(run);
        if (req.runHash() == null || !req.runHash().equals(currentHash)) {
            throw new ApiException(HttpStatus.CONFLICT, "Run state mismatch. Please refresh and review again before approving.");
        }

        run.setApprovedAt(Instant.now());
        List<ApplicationRunStep> steps = stepRepo.findByRunIdOrderByStepNumberAsc(runId);
        for (ApplicationRunStep s : steps) {
            if (s.getStepNumber() == 4 || s.getStepNumber() == 5) {
                s.setStatus("completed");
                s.setExecutedAt(Instant.now());
            }
        }
        stepRepo.saveAll(steps);
        run.setCompletedSteps((short) 5);
        run.setStatus(com.careerops.model.ApplicationRunStatus.completed);
        run.setSubmittedAt(Instant.now());
        return toRunResponse(runRepo.save(run), true);
    }

    @Transactional(timeout = 10)
    public ApplicationRunResponse retryRun(UUID userId, UUID runId) {
        ApplicationRun run = findRun(userId, runId);
        if (run.getStatus() != com.careerops.model.ApplicationRunStatus.failed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only failed runs can be retried");
        }
        // Reset failed steps to pending and re-execute from last completed
        List<ApplicationRunStep> steps = stepRepo.findByRunIdOrderByStepNumberAsc(runId);
        short lastCompleted = 0;
        for (ApplicationRunStep s : steps) {
            if (s.getStatus().equals("completed")) lastCompleted = s.getStepNumber();
        }
        for (ApplicationRunStep s : steps) {
            if (s.getStatus().equals("failed")) {
                s.setStatus(s.getStepNumber() <= lastCompleted + 1 ? "in_progress" : "pending");
                s.setErrorMessage(null);
            }
        }
        stepRepo.saveAll(steps);
        run.setStatus(com.careerops.model.ApplicationRunStatus.in_progress);
        run.setErrorMessage(null);
        return toRunResponse(runRepo.save(run), true);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ApplicationRun findRun(UUID userId, UUID runId) {
        return runRepo.findByIdAndUserId(runId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Application run not found"));
    }

    private String calculateHash(ApplicationRun r) {
        // Deterministic string representation of critical state
        String state = String.format("%s|%s|%s|%d",
            r.getId(),
            r.getStatus(),
            r.getResumeVersionId() != null ? r.getResumeVersionId() : "none",
            r.getCompletedSteps()
        );
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(state.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString().substring(0, 16); // 16 chars is enough for this guard
        } catch (Exception e) {
            return String.valueOf(state.hashCode()); // Fallback
        }
    }

    private AnswerBankEntry toAnswerEntry(AnswerBank a) {
        return new AnswerBankEntry(a.getId(), a.getQuestionKey(), a.getAnswerText(),
            a.isDefault(), a.getUpdatedAt());
    }

    private ApplicationRunResponse toRunResponse(ApplicationRun r, boolean includeSteps) {
        List<RunStepResponse> steps = includeSteps
            ? stepRepo.findByRunIdOrderByStepNumberAsc(r.getId())
                .stream().map(s -> new RunStepResponse(
                    s.getId(), s.getStepNumber(), s.getStepType(),
                    s.getDescription(), s.getStatus(), s.getErrorMessage(), s.getExecutedAt()
                )).toList()
            : List.of();
        return new ApplicationRunResponse(
            r.getId(), r.getUserJobId(), r.getStatus() != null ? r.getStatus().name() : null,
            r.getTotalSteps(), r.getCompletedSteps(),
            r.getErrorMessage(), r.getResumeVersionId(),
            r.getApprovedAt(), r.getSubmittedAt(), r.getCreatedAt(),
            calculateHash(r),
            steps
        );
    }
}
