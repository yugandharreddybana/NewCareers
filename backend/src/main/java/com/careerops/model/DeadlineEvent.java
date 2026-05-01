package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "deadline_events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeadlineEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_job_id", nullable = false)
    private UUID userJobId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "event_type", nullable = false)
    private String eventType;
    // APPLICATION_CLOSE | INTERVIEW_DATE | FOLLOW_UP | OFFER_DEADLINE | CUSTOM

    @Column(nullable = false)
    private String title;

    @Column
    private String notes;

    @Column(name = "event_date", nullable = false)
    private OffsetDateTime eventDate;

    @Column(name = "remind_at")
    private OffsetDateTime remindAt;

    @Column(name = "reminder_sent", nullable = false)
    private boolean reminderSent = false;

    @Column(name = "is_completed", nullable = false)
    private boolean completed = false;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
