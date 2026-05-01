package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Task 134 — runtime feature flag entity.
 * Managed via GET/PUT /admin/flags.
 */
@Entity
@Table(name = "feature_flags", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FeatureFlag {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "flag_key", nullable = false, unique = true)
    private String flagKey;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(length = 500)
    private String description;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
