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
 * JPA entity for the careerops.notifications table.
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
@Table(name = "notifications", schema = "careerops",
       indexes = {
           @Index(name = "idx_notifications_user_created", columnList = "user_id, created_at DESC")
       })
@org.hibernate.annotations.SQLRestriction("deleted_at IS NULL")
@org.hibernate.annotations.SQLDelete(sql = "UPDATE careerops.notifications SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Notification type — see class javadoc for valid values. */
    @Column(nullable = false, length = 50)
    private String type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    /** The domain entity type that triggered this notification, e.g. "application_task". */
    @Column(name = "entity_type", length = 100)
    private String entityType;

    /** The UUID of the entity that triggered this notification. */
    @Column(name = "entity_id")
    private UUID entityId;

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

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        validateType();
    }

    @PreUpdate
    void preUpdate() {
        validateType();
    }

    private void validateType() {
        if (type == null) {
            throw new IllegalStateException("Notification type cannot be null");
        }
        switch (type) {
            case TYPE_SKILL_COMPLETE:
            case TYPE_INTERVIEW_REMINDER:
            case TYPE_JOB_MATCH:
            case TYPE_WEEKLY_DIGEST:
            case TYPE_SYSTEM:
            case TYPE_REFERRAL:
            case TYPE_OVERDUE_TASK:
                break;
            default:
                throw new IllegalStateException("Invalid notification type: " + type);
        }
    }

    public static final String TYPE_SKILL_COMPLETE     = "SKILL_COMPLETE";
    public static final String TYPE_INTERVIEW_REMINDER = "INTERVIEW_REMINDER";
    public static final String TYPE_JOB_MATCH          = "JOB_MATCH";
    public static final String TYPE_WEEKLY_DIGEST      = "WEEKLY_DIGEST";
    public static final String TYPE_SYSTEM             = "SYSTEM";
    public static final String TYPE_REFERRAL           = "REFERRAL";
    public static final String TYPE_OVERDUE_TASK       = "OVERDUE_TASK";
}

