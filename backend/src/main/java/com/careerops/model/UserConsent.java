package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_consents", schema = "careerops",
       indexes = {
           @Index(name = "idx_user_consents_user_type_accepted_at",
                  columnList = "user_id, consent_type, accepted_at DESC")
       })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserConsent {

    public enum ConsentType {
        ESSENTIAL, AI_PROCESSING, MARKETING, ANALYTICS
    }

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "consent_type", nullable = false, length = 32)
    private ConsentType consentType;

    @Column(nullable = false, length = 32)
    private String version;

    @Column(nullable = false)
    private boolean accepted;

    @Column(name = "accepted_at", nullable = false, updatable = false)
    private Instant acceptedAt;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    @PrePersist
    void prePersist() {
        if (acceptedAt == null) {
            acceptedAt = Instant.now();
        }
    }
}
