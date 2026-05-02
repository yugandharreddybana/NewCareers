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

    public ApplicationAutomationService(ApplicationRunRepository runRepo,
                                        ApplicationRunStepRepository stepRepo,
                                        AnswerBankRepository answerBankRepo) {
        this.runRepo        = runRepo;
        this.stepRepo       = stepRepo;
        this.answerBankRepo = answerBankRepo;
    }

    // ── Answer bank ──────────────────────────────────────────────────────────

    public List<AnswerBankEntry> listAnswers(UUID userId) {
        return answerBankRepo.findByUserIdOrderByQuestionKeyAsc(userId)
            .stream().map(this::toAnswerEntry).toList();
    }

    @Transactional
    public AnswerBankEntry upsertAnswer(UUID userId, UpsertAnswerRequest req) {
        AnswerBank a = answerBankRepo.findByUserIdAndQuestionKey(userId, req.questionKey())
            .orElseGet(() -> AnswerBank.builder()
                .userId(userId)
                .questionKey(req.questionKey())
                .build());
        a.setAnswerText(req.answerText());
        return toAnswerEntry(answerBankRepo.save(a));
    }

    public void deleteAnswer(UUID userId, UUID id) {
        AnswerBank a = answerBankRepo.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Answer not found"));
        answerBankRepo.delete(a);
    }

    // ── Application runs ─────────────────────────────────────────────────────

    public RunListResponse listRuns(UUID userId) {
        List<ApplicationRunResponse> items = runRepo
            .findByUserIdOrderByCreatedAtDesc(userId)
            .stream().map(r -> toRunResponse(r, false)).toList();
        return new RunListResponse(items, items.size());
    }

    public ApplicationRunResponse getRunDetail(UUID userId, UUID runId) {
        ApplicationRun run = findRun(userId, runId);
        return toRunResponse(run, true);
    }

    @Transactional
    public ApplicationRunResponse startRun(UUID userId, UUID userJobId, StartRunRequest req) {
        // Build the standard 5-step flow
        ApplicationRun run = ApplicationRun.builder()
            .userId(userId)
            .userJobId(userJobId)
            .status("in_progress")
            .totalSteps((short) 5)
            .completedSteps((short) 0)
            .resumeVersionId(req != null ? req.resumeVersionId() : null)
            .build();
        run = runRepo.save(run);

        List<Object[]> stepDefs = List.of(
            new Object[]{ 1, "prefill",         "Pre-fill contact and personal details" },
            new Object[]{ 2, "cv_upload",        "Upload selected resume version" },
            new Object[]{ 3, "answer_question",  "Answer application questions from your answer bank" },
            new Object[]{ 4, "approval_gate",    "Review everything before submit" },
            new Object[]{ 5, "submit",           "Submit application" }
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
        run.setStatus("awaiting_approval");
        run = runRepo.save(run);

        return toRunResponse(run, true);
    }

    @Transactional
    public ApplicationRunResponse approveRun(UUID userId, UUID runId, ApproveRunRequest req) {
        ApplicationRun run = findRun(userId, runId);
        if (!run.getStatus().equals("awaiting_approval")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Run is not awaiting approval");
        }

        if (!req.approved()) {
            run.setStatus("cancelled");
            return toRunResponse(runRepo.save(run), true);
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
        run.setStatus("completed");
        run.setSubmittedAt(Instant.now());
        return toRunResponse(runRepo.save(run), true);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ApplicationRun findRun(UUID userId, UUID runId) {
        return runRepo.findByIdAndUserId(runId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Application run not found"));
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
            r.getId(), r.getUserJobId(), r.getStatus(),
            r.getTotalSteps(), r.getCompletedSteps(),
            r.getErrorMessage(), r.getResumeVersionId(),
            r.getApprovedAt(), r.getSubmittedAt(), r.getCreatedAt(), steps
        );
    }
}
