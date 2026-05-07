package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "interview_question_bank", schema = "career_operations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewQuestionBank {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "session_id")
    private UUID sessionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "user_job_id")
    private UUID userJobId;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "role_title")
    private String roleTitle;

    @Column(name = "skill_area")
    private String skillArea;

    @Column(nullable = false, columnDefinition = "text")
    private String question;

    @Column(name = "model_answer", columnDefinition = "text")
    private String modelAnswer;

    @Column(name = "user_answer", columnDefinition = "text")
    private String userAnswer;

    @Column(precision = 5, scale = 2)
    private BigDecimal score;

    @Column(name = "turn_number")
    @Builder.Default
    private Integer turnNumber = 0;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
