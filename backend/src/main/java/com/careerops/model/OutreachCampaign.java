package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outreach_campaigns", schema = "careerops")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OutreachCampaign {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 255)
    private String name;

    @Builder.Default
    @Column(name = "campaign_type", nullable = false, length = 50)
    private String campaignType = "recruiter_outreach";

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String status = "draft";

    @Builder.Default
    @Column(name = "target_count", nullable = false)
    private int targetCount = 0;

    @Builder.Default
    @Column(name = "sent_count", nullable = false)
    private int sentCount = 0;

    @Builder.Default
    @Column(name = "replied_count", nullable = false)
    private int repliedCount = 0;

    @Builder.Default
    @Column(name = "positive_count", nullable = false)
    private int positiveCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }
}

