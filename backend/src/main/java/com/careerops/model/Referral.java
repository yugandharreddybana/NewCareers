package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Section 9 — Task 94.
 * Maps to careerops.referrals.
 */
@Entity
@Table(name = "referrals", schema = "careerops")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Referral {

    /** Status constants — mirrors the DB CHECK constraint. */
    public static final String STATUS_PENDING   = "pending";
    public static final String STATUS_SIGNED_UP = "signed_up";
    public static final String STATUS_REWARDED  = "rewarded";

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "referrer_id", nullable = false)
    private UUID referrerId;

    @Column(name = "referee_email", nullable = false, length = 255)
    private String refereeEmail;

    /** Unique invite token embedded in the referral link sent by email. */
    @Column(name = "token", nullable = false, unique = true)
    private UUID token;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "rewarded_at")
    private Instant rewardedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (token     == null) token     = UUID.randomUUID();
        if (status    == null) status    = STATUS_PENDING;
    }
}

