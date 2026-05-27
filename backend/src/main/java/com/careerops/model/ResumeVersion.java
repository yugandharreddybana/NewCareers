package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "resume_versions", schema = "careerops")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ResumeVersion {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 255)
    private String name;

    @Builder.Default
    @Column(name = "version_number", nullable = false)
    private int versionNumber = 1;

    @Builder.Default
    @Column(nullable = false, length = 100)
    private String source = "manual";

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "role_tags", columnDefinition = "text array")
    private String[] roleTags;

    // Field named `active` → Lombok generates isActive() getter + setActive() setter
    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = false;

    // Field named `favorite` → Lombok generates isFavorite() getter + setFavorite() setter
    @Builder.Default
    @Column(name = "is_favorite", nullable = false)
    private boolean favorite = false;

    @Column(name = "outcome_association", length = 100)
    private String outcomeAssociation;

    @Builder.Default
    @Column(name = "interview_count", nullable = false)
    private int interviewCount = 0;

    @Builder.Default
    @Column(name = "application_count", nullable = false)
    private int applicationCount = 0;

    @Builder.Default
    @Column(name = "offer_count", nullable = false)
    private int offerCount = 0;

    @Column(name = "best_for_role_type", length = 255)
    private String bestForRoleType;

    @Column(name = "storage_path", length = 500)
    private String storagePath;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(columnDefinition = "TEXT")
    private String notes;

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

