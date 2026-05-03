package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "interview_question_bank", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InterviewQuestionBank {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "interview_track_id")
    private UUID interviewTrackId;

    @Column(name = "session_id")
    private UUID sessionId;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "role_title")
    private String roleTitle;

    @Column(name = "skill_area")
    private String skillArea;

    @Column(name = "question", columnDefinition = "TEXT")
    private String question;

    @Column(name = "expected_answer", columnDefinition = "TEXT")
    private String expectedAnswer;

    @Column(name = "user_answer", columnDefinition = "TEXT")
    private String userAnswer;

    @Column(name = "score")
    private Integer score;

    @Column(name = "ai_feedback", columnDefinition = "TEXT")
    private String aiFeedback;

    @Column(name = "question_type")
    private String questionType;

    @Column(name = "user_job_id")
    private UUID userJobId;

    @Column(name = "questions_json", columnDefinition = "TEXT")
    private String questionsJson;

    @Column(name = "generated_at")
    private Instant generatedAt;

    @Column(name = "created_at")
    private Instant createdAt;

    public void setTrackId(UUID trackId) {
        this.interviewTrackId = trackId;
    }
    public UUID getTrackId() {
        return this.interviewTrackId;
    }

    public void setCompany(String company) {
        this.companyName = company;
    }
    public String getCompany() {
        return this.companyName;
    }

    public void setGeneratedAt(java.time.LocalDateTime dt) {
        if (dt != null) {
            this.generatedAt = dt.atZone(java.time.ZoneId.systemDefault()).toInstant();
        }
    }
    public java.time.LocalDateTime getGeneratedAt() {
        if (this.generatedAt != null) {
            return java.time.LocalDateTime.ofInstant(this.generatedAt, java.time.ZoneId.systemDefault());
        }
        return null;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (questionType == null) questionType = "BEHAVIORAL";
    }
}
