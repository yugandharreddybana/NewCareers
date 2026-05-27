package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "application_cvs", schema = "careerops")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ApplicationCv {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "user_job_id", nullable = false) private UUID userJobId;
    @Column(name = "storage_path", nullable = false) private String storagePath;
    @Column(name = "file_name") private String fileName;
    @Column(name = "uploaded_at") private Instant uploadedAt;

    @PrePersist void onCreate() { if (uploadedAt == null) uploadedAt = Instant.now(); }
}

