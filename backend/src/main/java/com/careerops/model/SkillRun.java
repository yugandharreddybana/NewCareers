package com.careerops.model;

import com.fasterxml.jackson.databind.JsonNode;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "skill_runs", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SkillRun {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "user_job_id") private UUID userJobId;
    @Column(nullable = false) private String skill;

    @Type(JsonBinaryType.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode input;

    @Type(JsonBinaryType.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode output;

    @Column(name = "created_at") private Instant createdAt;

    @PrePersist void onCreate() { if (createdAt == null) createdAt = Instant.now(); }
}
