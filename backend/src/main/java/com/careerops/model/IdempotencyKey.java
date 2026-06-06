package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Issue 2.047 — Idempotency Key storage.
 * Stores the result of POST operations to prevent duplicate processing on retries.
 */
@Entity
@Table(name = "idempotency_keys", schema = "careerops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IdempotencyKey {

    @Id
    @Column(length = 64)
    private String idempotencyKey;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String requestPath;

    @Column(columnDefinition = "TEXT")
    private String responseBody;

    @Column(nullable = false)
    private int responseStatus;

    @Column(nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
}
