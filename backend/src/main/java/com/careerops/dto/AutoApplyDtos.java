package com.careerops.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class AutoApplyDtos {

    public record AnswerBankEntry(
        UUID id,
        String questionKey,
        String answerText,
        boolean isDefault,
        Instant updatedAt
    ) {}

    public record UpsertAnswerRequest(String questionKey, String answerText) {}

    public record ApplicationRunResponse(
        UUID id,
        UUID userJobId,
        String status,
        short totalSteps,
        short completedSteps,
        String errorMessage,
        UUID resumeVersionId,
        Instant approvedAt,
        Instant submittedAt,
        Instant createdAt,
        List<RunStepResponse> steps
    ) {}

    public record RunStepResponse(
        UUID id,
        short stepNumber,
        String stepType,
        String description,
        String status,
        String errorMessage,
        Instant executedAt
    ) {}

    public record StartRunRequest(UUID resumeVersionId) {}

    public record ApproveRunRequest(boolean approved) {}

    public record RunListResponse(List<ApplicationRunResponse> runs, int total) {}
}
