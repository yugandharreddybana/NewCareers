package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "user_domain_mappings",
        schema = "careerops",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_user_domain_mappings_domain_sector",
                columnNames = {"domain_key", "sector_code"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDomainMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "domain_key", nullable = false, columnDefinition = "TEXT")
    private String domainKey;

    @Column(name = "sector_code", nullable = false, columnDefinition = "TEXT")
    private String sectorCode;
}
