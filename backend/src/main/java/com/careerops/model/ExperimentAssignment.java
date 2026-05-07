package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "experiment_assignments", schema = "career_operations",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "experiment_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ExperimentAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "experiment_id", nullable = false)
    private UUID experimentId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 100)
    private String variant;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt;

    @PrePersist
    protected void onCreate() { assignedAt = Instant.now(); }
}
