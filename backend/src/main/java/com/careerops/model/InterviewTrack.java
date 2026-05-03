package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "interview_tracks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewTrack {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "user_job_id", nullable = false)
    private UUID userJobId;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "role_title")
    private String roleTitle;

    @Column(name = "current_stage")
    private String currentStage = "applied";

    @Column(name = "interview_date")
    private Instant interviewDate;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
