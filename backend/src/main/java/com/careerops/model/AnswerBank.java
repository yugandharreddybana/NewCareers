package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "answer_bank",
    schema = "career_operations",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "question_key"})
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AnswerBank {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "question_key", nullable = false, length = 100)
    private String questionKey;

    @Column(name = "answer_text", nullable = false, columnDefinition = "TEXT")
    private String answerText;

    @Builder.Default
    @Column(name = "is_default", nullable = false)
    private boolean isDefault = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }
}
