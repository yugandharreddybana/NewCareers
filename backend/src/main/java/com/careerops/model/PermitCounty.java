package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "permit_counties", schema = "careerops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PermitCounty {

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

    @Column(nullable = false, columnDefinition = "TEXT")
    private String county;

    @Column(nullable = false)
    @Builder.Default
    private Integer issued = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer refused = 0;
}
