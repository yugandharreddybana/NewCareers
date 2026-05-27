package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "interview_sessions", schema = "careerops",
       indexes = {
           @Index(name = "idx_interview_sessions_user_created", columnList = "user_id, created_at DESC")
       })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewSession {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "track_id")
    private UUID trackId;

    @Column(name = "user_job_id")
    private UUID userJobId;

    @Column(nullable = false)
    @Builder.Default
    private String mode = "text";

    @Column(nullable = false)
    @Builder.Default
    private String status = "in_progress";

    @Column(name = "overall_score", precision = 5, scale = 2)
    private BigDecimal overallScore;

    @Column(columnDefinition = "text")
    private String strengths;

    @Column(columnDefinition = "text")
    private String weaknesses;

    @Column(name = "started_at")
    @Builder.Default
    private Instant startedAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

