package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "password_resets", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PasswordReset {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false) private String email;
    @Column(name = "otp_hash", nullable = false) private String otpHash;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    private Boolean used;
    @Column(name = "created_at") private Instant createdAt;

    @PrePersist void onCreate() { if (createdAt == null) createdAt = Instant.now(); if (used == null) used = false; }
}
