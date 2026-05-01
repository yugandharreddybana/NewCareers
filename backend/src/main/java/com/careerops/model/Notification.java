package com.careerops.model;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Section 8 — Task 79
 * JPA entity for the career_operations.notifications table.
 *
 * Notification types (stored in {@code type} column):
 *   SKILL_COMPLETE      — a long-running AI skill finished
 *   INTERVIEW_REMINDER  — Kanban card moved to Interview column
 *   JOB_MATCH           — high-quality new job delivered
 *   WEEKLY_DIGEST       — weekly summary email sent
 *   SYSTEM              — general platform messages
 *   REFERRAL            — referral invite/signup/reward events
 */
@Entity
@Table(name = "notifications", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Notification type — see class javadoc for valid values. */
    @Column(nullable = false, length = 50)
    private String type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    /** false = unread (default), true = read */
    @Builder.Default
    @Column(nullable = false)
    private boolean read = false;

    /** Optional JSONB payload — e.g. { "userJobId": "...", "skillName": "..." } */
    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public static final String TYPE_SKILL_COMPLETE     = "SKILL_COMPLETE";
    public static final String TYPE_INTERVIEW_REMINDER = "INTERVIEW_REMINDER";
    public static final String TYPE_JOB_MATCH          = "JOB_MATCH";
    public static final String TYPE_WEEKLY_DIGEST      = "WEEKLY_DIGEST";
    public static final String TYPE_SYSTEM             = "SYSTEM";
    public static final String TYPE_REFERRAL           = "REFERRAL";
}
