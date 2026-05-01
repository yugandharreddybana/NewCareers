package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "user_streaks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserStreak {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(name = "current_daily_streak", nullable = false)
    private Integer currentDailyStreak = 0;

    @Column(name = "longest_daily_streak", nullable = false)
    private Integer longestDailyStreak = 0;

    @Column(name = "last_active_date")
    private LocalDate lastActiveDate;

    @Column(name = "total_jobs_reviewed", nullable = false)
    private Integer totalJobsReviewed = 0;

    @Column(name = "total_apps_submitted", nullable = false)
    private Integer totalAppsSubmitted = 0;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist @PreUpdate
    protected void onUpdate() { this.updatedAt = Instant.now(); }
}
