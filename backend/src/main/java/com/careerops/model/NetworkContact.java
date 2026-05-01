package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Section 3.3 — Task 33
 * Maps to career_operations.network_contacts
 */
@Entity
@Table(name = "network_contacts", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NetworkContact {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    private String email;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    private String company;

    @Column(name = "role_title")
    private String roleTitle;

    @Column(name = "contact_type", nullable = false)
    @Enumerated(EnumType.STRING)
    private ContactType contactType;

    @Column(name = "relationship_temperature", nullable = false)
    @Enumerated(EnumType.STRING)
    private RelationshipTemperature relationshipTemperature;

    @Column(name = "pipeline_stage", nullable = false)
    @Enumerated(EnumType.STRING)
    private ContactPipelineStage pipelineStage;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "linked_user_job_id")
    private UUID linkedUserJobId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    // ── Enums ──────────────────────────────────────────────────────────────────

    public enum ContactType {
        recruiter, hiring_manager, alumni, referral
    }

    public enum RelationshipTemperature {
        cold, warm, hot
    }

    public enum ContactPipelineStage {
        identified, connected, outreached, replied, meeting_scheduled, closed
    }
}
