package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "referral_outbox", schema = "careerops")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReferralOutbox {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "referee_email", nullable = false)
    private String refereeEmail;

    @Column(name = "referee_name", nullable = false)
    private String refereeName;

    @Builder.Default
    @Column(nullable = false)
    private boolean processed = false;

    @Builder.Default
    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "processed_at")
    private Instant processedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

