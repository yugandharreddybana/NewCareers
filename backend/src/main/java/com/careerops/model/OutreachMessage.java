package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outreach_messages", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OutreachMessage {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "campaign_id", nullable = false)
    private UUID campaignId;

    @Column(name = "sequence_id")
    private UUID sequenceId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "contact_name", length = 255)
    private String contactName;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "contact_linkedin", length = 500)
    private String contactLinkedin;

    @Column(name = "personalised_body", nullable = false, columnDefinition = "TEXT")
    private String personalisedBody;

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String status = "draft";

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "replied_at")
    private Instant repliedAt;

    @Column
    private Short score;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }
}
