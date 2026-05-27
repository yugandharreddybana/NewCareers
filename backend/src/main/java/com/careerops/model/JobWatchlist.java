package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "job_watchlists", schema = "careerops",
       indexes = {
           @Index(name = "idx_job_watchlists_user", columnList = "user_id")
       })
@org.hibernate.annotations.SQLRestriction("deleted_at IS NULL")
@org.hibernate.annotations.SQLDelete(sql = "UPDATE careerops.job_watchlists SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class JobWatchlist {

    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_INACTIVE = "inactive";

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

    @Column(name = "deleted_at")
    private Instant deletedAt;

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

