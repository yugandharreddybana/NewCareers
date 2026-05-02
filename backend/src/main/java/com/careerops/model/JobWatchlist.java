package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "job_watchlists", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class JobWatchlist {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "query_keywords", columnDefinition = "TEXT")
    private String queryKeywords;

    @Column(length = 255)
    private String location;

    @Column(name = "min_salary")
    private Integer minSalary;

    @Column(name = "max_salary")
    private Integer maxSalary;

    @Builder.Default
    @Column(name = "remote_only", nullable = false)
    private boolean remoteOnly = false;

    @Builder.Default
    @Column(name = "sponsorship_required", nullable = false)
    private boolean sponsorshipRequired = false;

    @Builder.Default
    @Column(name = "min_match_score", nullable = false)
    private short minMatchScore = 0;

    @Builder.Default
    @Column(name = "alert_email", nullable = false)
    private boolean alertEmail = true;

    @Builder.Default
    @Column(name = "alert_in_app", nullable = false)
    private boolean alertInApp = true;

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String status = "active";

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Builder.Default
    @Column(name = "matched_total", nullable = false)
    private int matchedTotal = 0;

    @Builder.Default
    @Column(name = "clicked_total", nullable = false)
    private int clickedTotal = 0;

    @Builder.Default
    @Column(name = "applied_total", nullable = false)
    private int appliedTotal = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
