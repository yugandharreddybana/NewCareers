package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "interview_sessions", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InterviewSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "interview_track_id")
    private UUID interviewTrackId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "mode")
    private String mode;

    @Column(name = "overall_score")
    private Integer overallScore;

    @Column(name = "feedback_summary", columnDefinition = "TEXT")
    private String feedbackSummary;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "user_job_id")
    private UUID userJobId;

    @Column(name = "status")
    private String status;

    @Column(name = "turn_count")
    private Integer turnCount;

    @Column(name = "current_question", columnDefinition = "TEXT")
    private String currentQuestion;

    @Column(name = "transcript_json", columnDefinition = "TEXT")
    private String transcriptJson;

    @Column(name = "answers_json", columnDefinition = "TEXT")
    private String answersJson;

    public void setTrackId(UUID trackId) {
        this.interviewTrackId = trackId;
    }
    public UUID getTrackId() {
        return this.interviewTrackId;
    }

    public void setScore(int score) {
        this.overallScore = score;
    }
    public int getScore() {
        return this.overallScore != null ? this.overallScore : 0;
    }

    public void setFeedback(String feedback) {
        this.feedbackSummary = feedback;
    }
    public String getFeedback() {
        return this.feedbackSummary;
    }

    public void setCompletedAt(java.time.LocalDateTime dt) {
        if (dt != null) {
            this.completedAt = dt.atZone(java.time.ZoneId.systemDefault()).toInstant();
        }
    }
    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public void setStartedAt(java.time.LocalDateTime dt) {
        if (dt != null) {
            this.startedAt = dt.atZone(java.time.ZoneId.systemDefault()).toInstant();
        }
    }
    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (startedAt == null) startedAt = Instant.now();
        if (mode == null) mode = "TEXT";
    }
}
