package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "signup_intents", schema = "careerops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SignupIntent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(length = 100)
    private String name;

    @Column(name = "terms_accepted", nullable = false)
    private boolean termsAccepted;

    @Column(name = "ai_processing_accepted", nullable = false)
    private boolean aiProcessingAccepted;

    @Column(name = "marketing_accepted", nullable = false)
    private boolean marketingAccepted;

    @Column(name = "analytics_accepted", nullable = false)
    private boolean analyticsAccepted;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
