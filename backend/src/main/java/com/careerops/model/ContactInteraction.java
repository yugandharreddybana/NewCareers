package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Section 3.3 — Task 34
 * Maps to career_operations.contact_interactions
 */
@Entity
@Table(name = "contact_interactions", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ContactInteraction {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "contact_id", nullable = false)
    private UUID contactId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "interaction_type", nullable = false)
    @Enumerated(EnumType.STRING)
    private InteractionType interactionType;

    @Enumerated(EnumType.STRING)
    private InteractionOutcome outcome;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "next_step")
    private String nextStep;

    @Column(name = "next_step_due_date")
    private LocalDate nextStepDueDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    // ── Enums ──────────────────────────────────────────────────────────────────

    public enum InteractionType {
        linkedin_message, email, call, meeting, follow_up
    }

    public enum InteractionOutcome {
        no_response, positive, negative, meeting_booked
    }
}
