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
 *   OVERDUE_TASK        — an application planner task has passed its due date
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

    /**
     * Convenience alias — maps to the same {@code body} column.
     * Services may call setMessage()/getMessage() interchangeably with setBody()/getBody().
     * Stored in the single {@code body} TEXT column.
     */
    @Transient
    public String getMessage() { return body; }
    @Transient
    public void setMessage(String message) { this.body = message; }

    /** The domain entity type that triggered this notification, e.g. "application_task". */
    @Column(name = "entity_type", length = 100)
    private String entityType;

    /** The UUID (as string) of the entity that triggered this notification. */
    @Column(name = "entity_id", length = 100)
    private String entityId;

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
    public static final String TYPE_OVERDUE_TASK       = "OVERDUE_TASK";
}
