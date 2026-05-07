package com.careerops.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * 4.035 — Shared @MappedSuperclass for entities requiring unified ID and timestamps.
 * 
 * Note on Lombok Builders:
 * Project entities using standard Lombok @Builder can extend BaseEntity,
 * but to builder-initialize parent fields like 'createdAt', both BaseEntity and 
 * subclasses would require transition to Lombok's @SuperBuilder.
 */
@MappedSuperclass
@Getter
@Setter
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
