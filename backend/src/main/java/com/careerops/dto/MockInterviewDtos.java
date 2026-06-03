package com.careerops.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * DTOs for MockInterviewController.
 *
 * B2-G4 / B3 fix: MockInterviewController was referencing these types
 * but the file did not exist, causing a compilation failure.
 */
public class MockInterviewDtos {

    // ── Request ──────────────────────────────────────────────────────────────

    /**
     * Request body for POST /api/v1/mock-interview/interview-kit[/async].
     */
    @Data
    public static class InterviewKitRequest {

        /** The UserJob to generate interview questions for. */
        @NotNull(message = "userJobId is required")
        private UUID userJobId;

        /** Job title used in the Gemini prompt. */
        private String jobTitle;

        /** Short job-description excerpt (max ~600 chars in practice). */
        private String jobDesc;

        /** Candidate CV summary (max ~400 chars in practice). */
        private String cvSummary;
    }

    // ── Response ─────────────────────────────────────────────────────────────

    @Data
    @Builder
    public static class InterviewKitResponse {

        /** The UserJob this kit belongs to. */
        private UUID userJobId;

        /** Generated interview questions with model answers. */
        private List<QuestionItem> questions;

        /** ISO-8601 timestamp of when the kit was generated. */
        private Instant generatedAt;

        /** Number of questions generated. */
        private int questionCount;
    }

    // ── Question item embedded in InterviewKitResponse ────────────────────────

    @Data
    @Builder
    public static class QuestionItem {
        private UUID   id;
        private String question;
        private String modelAnswer;
        private String skillArea;  // TECHNICAL | BEHAVIOURAL | SITUATIONAL | CULTURE_FIT
    }
}
