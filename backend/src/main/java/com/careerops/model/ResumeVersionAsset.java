package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "resume_version_assets", schema = "careerops")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ResumeVersionAsset {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "version_id", nullable = false)
    private UUID versionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Builder.Default
    @Column(name = "asset_type", nullable = false, length = 50)
    private String assetType = "pdf";

    @Column(name = "storage_key", length = 500)
    private String storageKey;

    @Column(name = "file_size_bytes")
    private Integer fileSizeBytes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

