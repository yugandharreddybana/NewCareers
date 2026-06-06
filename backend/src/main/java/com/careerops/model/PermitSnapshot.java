package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "permit_snapshots", schema = "careerops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PermitSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_year", nullable = false)
    private Integer sourceYear;

    @Column(name = "is_full_year", nullable = false)
    @Builder.Default
    private boolean fullYear = false;

    @Column(name = "fetched_at", nullable = false, updatable = false)
    private Instant fetchedAt;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "row_count_companies")
    @Builder.Default
    private Integer rowCountCompanies = 0;

    @Column(name = "row_count_sectors")
    @Builder.Default
    private Integer rowCountSectors = 0;

    @Column(name = "row_count_counties")
    @Builder.Default
    private Integer rowCountCounties = 0;

    @PrePersist
    void onCreate() {
        if (fetchedAt == null) {
            fetchedAt = Instant.now();
        }
    }
}
