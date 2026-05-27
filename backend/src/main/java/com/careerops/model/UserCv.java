package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_cvs", schema = "careerops")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserCv {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "file_name", nullable = false) private String fileName;
    @Column(name = "storage_path", nullable = false) private String storagePath;
    @Column(name = "file_type") private String fileType;
    @Lob @Column(name = "parsed_text") private String parsedText;
    /** Structured markdown for AI skills (Career-Ops cv.md equivalent). */
    @Lob @Column(name = "cv_markdown") private String cvMarkdown;
    @org.hibernate.annotations.Type(io.hypersistence.utils.hibernate.type.json.JsonType.class)
    @Column(name = "vector_json", columnDefinition = "jsonb")
    private com.fasterxml.jackson.databind.JsonNode vectorJson;
    @Column(name = "uploaded_at") private Instant uploadedAt;
    @Column(name = "is_active") private Boolean isActive;
    @Lob @Column(name = "file_data", columnDefinition = "bytea") private byte[] fileData;

    @PrePersist
    void onCreate() {
        if (uploadedAt == null) uploadedAt = Instant.now();
        if (isActive == null) isActive = Boolean.TRUE;
    }
}

