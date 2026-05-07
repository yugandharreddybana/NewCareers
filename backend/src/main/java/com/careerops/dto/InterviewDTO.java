package com.careerops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class InterviewDTO {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class QuestionResponse {
        private UUID id;
        private UUID sessionId;
        private UUID userJobId;
        private String companyName;
        private String roleTitle;
        private String skillArea;
        private String question;
        private String modelAnswer;
        private String userAnswer;
        private BigDecimal score;
        private Integer turnNumber;
        private Instant createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SessionResponse {
        private UUID id;
        private UUID trackId;
        private UUID userJobId;
        private String mode;
        private String status;
        private BigDecimal overallScore;
        private String strengths;
        private String weaknesses;
        private Instant startedAt;
        private Instant completedAt;
        private Instant createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrackResponse {
        private UUID id;
        private UUID userJobId;
        private String companyName;
        private String roleTitle;
        private String currentStage;
        private Instant interviewDate;
        private String notes;
        private Instant createdAt;
        private Instant updatedAt;
    }
}
