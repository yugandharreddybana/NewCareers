package com.careerops.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Task 20 — DeadlineEvent entity.
 * Tracks important dates: application close, interview, follow-up, offer deadline.
 */
@Entity
@Table(name = "deadline_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeadlineEvent {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_job_id", nullable = false)
    private UUID userJobId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "event_date", nullable = false)
    private LocalDateTime eventDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "reminder_sent")
    private boolean reminderSent = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
