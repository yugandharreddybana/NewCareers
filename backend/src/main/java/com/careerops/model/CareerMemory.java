package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "career_memories",
    schema = "careerops",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "category", "key"})
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CareerMemory {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 100)
    private String category;

    @Column(nullable = false, length = 255)
    private String key;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String value;

    @Column(length = 100)
    private String source;

    @Column(name = "why_suggested", columnDefinition = "TEXT")
    private String whySuggested;

    @Builder.Default
    @Column(nullable = false)
    private short confidence = 80;

    @Builder.Default
    @Column(name = "memory_enabled", nullable = false)
    private boolean memoryEnabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}

