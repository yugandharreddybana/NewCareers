package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "user_streaks", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserStreak {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Builder.Default
    @Column(name = "current_daily_streak", nullable = false)
    private Integer currentDailyStreak = 0;

    @Builder.Default
    @Column(name = "longest_daily_streak", nullable = false)
    private Integer longestDailyStreak = 0;

    @Column(name = "last_active_date")
    private LocalDate lastActiveDate;

    @Builder.Default
    @Column(name = "total_jobs_reviewed", nullable = false)
    private Integer totalJobsReviewed = 0;

    @Builder.Default
    @Column(name = "total_apps_submitted", nullable = false)
    private Integer totalAppsSubmitted = 0;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist @PreUpdate
    protected void onUpdate() { this.updatedAt = Instant.now(); }
}
