package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "permit_sectors", schema = "careerops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PermitSector {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "snapshot_id", nullable = false)
    private Long snapshotId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snapshot_id", insertable = false, updatable = false)
    private PermitSnapshot snapshot;

    @Column(name = "source_year", nullable = false)
    private Integer sourceYear;

    @Column(name = "sector_code", nullable = false, columnDefinition = "TEXT")
    private String sectorCode;

    @Column(name = "sector_name", nullable = false, columnDefinition = "TEXT")
    private String sectorName;

    @Column(name = "permits_jan")
    private Integer permitsJan;

    @Column(name = "permits_feb")
    private Integer permitsFeb;

    @Column(name = "permits_mar")
    private Integer permitsMar;

    @Column(name = "permits_apr")
    private Integer permitsApr;

    @Column(name = "permits_may")
    private Integer permitsMay;

    @Column(name = "permits_jun")
    private Integer permitsJun;

    @Column(name = "permits_jul")
    private Integer permitsJul;

    @Column(name = "permits_aug")
    private Integer permitsAug;

    @Column(name = "permits_sep")
    private Integer permitsSep;

    @Column(name = "permits_oct")
    private Integer permitsOct;

    @Column(name = "permits_nov")
    private Integer permitsNov;

    @Column(name = "permits_dec")
    private Integer permitsDec;

    @Column(name = "grand_total", nullable = false)
    @Builder.Default
    private Integer grandTotal = 0;
}
