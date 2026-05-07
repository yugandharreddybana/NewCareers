package com.careerops.model;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Section 5 — Task 44
 * JPA entity for the analytics_events table.
 * Stores user activity events (skill_run_complete, job_viewed, application_submitted, etc.)
 * with flexible JSONB metadata for per-event context.
 */
@Entity
@Table(name = "analytics_events", schema = "career_operations", indexes = {
    @Index(name = "idx_analytics_user_type_created",
           columnList = "user_id, event_type, created_at DESC")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AnalyticsEvent {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", columnDefinition = "uuid", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "event_type", nullable = false, length = 50, updatable = false)
    private String eventType;

    @Type(JsonType.class)
    @Column(name = "metadata", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public AnalyticsEvent(UUID userId, String eventType, Map<String, Object> metadata) {
        this.userId    = userId;
        this.eventType = eventType;
        this.metadata  = metadata != null ? metadata : new HashMap<>();
    }

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (metadata  == null) metadata  = new HashMap<>();
    }
}
