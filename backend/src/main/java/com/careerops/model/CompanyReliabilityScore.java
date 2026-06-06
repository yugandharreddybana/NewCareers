package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "company_reliability_scores", schema = "careerops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompanyReliabilityScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employer_name_normalised", nullable = false, unique = true, columnDefinition = "TEXT")
    private String employerNameNormalised;

    @Column(name = "canonical_name", nullable = false, columnDefinition = "TEXT")
    private String canonicalName;

    @Column(name = "first_seen_year", nullable = false)
    private Integer firstSeenYear;

    @Column(name = "last_seen_year", nullable = false)
    private Integer lastSeenYear;

    @Column(name = "years_active", nullable = false)
    private Integer yearsActive;

    @Column(name = "total_years_in_dataset", nullable = false)
    private Integer totalYearsInDataset;

    @Column(name = "reliability_score", nullable = false, precision = 5, scale = 2)
    private BigDecimal reliabilityScore;

    @Column(name = "reliability_tier", nullable = false, columnDefinition = "TEXT")
    private String reliabilityTier;

    @Column(name = "total_permits_all_time", nullable = false)
    @Builder.Default
    private Integer totalPermitsAllTime = 0;

    @Column(name = "peak_year")
    private Integer peakYear;

    @Column(name = "peak_year_total")
    private Integer peakYearTotal;

    @Column(name = "avg_annual_permits", precision = 8, scale = 2)
    private BigDecimal avgAnnualPermits;

    @Column(name = "trend_3yr", columnDefinition = "TEXT")
    private String trend3yr;

    @Column(name = "yoy_change_pct", precision = 6, scale = 2)
    private BigDecimal yoyChangePct;

    @Column(name = "sector_code", columnDefinition = "TEXT")
    private String sectorCode;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
