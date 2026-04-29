package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_cvs", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserCv {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "file_name", nullable = false) private String fileName;
    @Column(name = "storage_path", nullable = false) private String storagePath;
    @Column(name = "file_type") private String fileType;
    @Lob @Column(name = "parsed_text") private String parsedText;
    @Column(name = "uploaded_at") private Instant uploadedAt;
    @Column(name = "is_active") private Boolean isActive;

    @PrePersist void onCreate() { if (uploadedAt == null) uploadedAt = Instant.now(); }
}
