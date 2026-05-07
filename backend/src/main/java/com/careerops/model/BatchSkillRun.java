package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "batch_skill_runs", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BatchSkillRun {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "user_job_id", nullable = false)
    private UUID userJobId;

    @Column(nullable = false)
    private String status; // in_progress, completed, failed

    @Column(name = "total_skills")
    private int totalSkills;

    @Column(name = "completed_skills")
    private int completedSkills;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
