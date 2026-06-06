package com.careerops.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "user_permit_watchlist",
        schema = "careerops",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_user_permit_watchlist_user_employer",
                columnNames = {"user_id", "employer_name_normalised"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPermitWatchlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "employer_name_normalised", nullable = false, columnDefinition = "TEXT")
    private String employerNameNormalised;

    @CreationTimestamp
    @Column(name = "added_at", updatable = false)
    private Instant addedAt;
}
