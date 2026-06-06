package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "company_year_history",
        schema = "careerops",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_company_year_history_employer_year",
                columnNames = {"employer_name_normalised", "source_year"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompanyYearHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employer_name_normalised", nullable = false, columnDefinition = "TEXT")
    private String employerNameNormalised;

    @Column(name = "source_year", nullable = false)
    private Integer sourceYear;

    @Column(name = "grand_total", nullable = false)
    @Builder.Default
    private Integer grandTotal = 0;

    @Column(name = "rank_that_year")
    private Integer rankThatYear;

    @Column(name = "snapshot_id")
    private Long snapshotId;
}
