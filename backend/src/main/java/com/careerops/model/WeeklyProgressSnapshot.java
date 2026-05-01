package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "weekly_progress_snapshots")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WeeklyProgressSnapshot {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "week_end", nullable = false)
    private LocalDate weekEnd;

    @Column(name = "jobs_reviewed", nullable = false)
    private Integer jobsReviewed = 0;

    @Column(name = "applications_submitted", nullable = false)
    private Integer applicationsSubmitted = 0;

    @Column(name = "interviews_scheduled", nullable = false)
    private Integer interviewsScheduled = 0;

    @Column(name = "responses_received", nullable = false)
    private Integer responsesReceived = 0;

    @Column(name = "offers_received", nullable = false)
    private Integer offersReceived = 0;

    @Column(name = "daily_use_streak", nullable = false)
    private Integer dailyUseStreak = 0;

    @Column(name = "max_daily_use_streak", nullable = false)
    private Integer maxDailyUseStreak = 0;

    @Column(name = "wins_summary", columnDefinition = "TEXT")
    private String winsSummary;

    @Column(name = "bottlenecks_summary", columnDefinition = "TEXT")
    private String bottlenecksSummary;

    @Column(columnDefinition = "TEXT")
    private String recommendations;

    @Column(name = "best_performing_category")
    private String bestPerformingCategory;

    @Column(name = "response_rate", precision = 5, scale = 2)
    private BigDecimal responseRate;

    @Column(name = "interview_rate", precision = 5, scale = 2)
    private BigDecimal interviewRate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() { this.createdAt = Instant.now(); }
}
