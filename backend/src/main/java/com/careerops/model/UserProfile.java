package com.careerops.model;

import io.hypersistence.utils.hibernate.type.array.StringArrayType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_profiles", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserProfile {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true) private UUID userId;

    @Type(StringArrayType.class)
    @Column(name = "target_roles", columnDefinition = "text[]")
    private String[] targetRoles;

    @Type(StringArrayType.class)
    @Column(name = "tech_stack", columnDefinition = "text[]")
    private String[] techStack;

    private String location;

    @Column(name = "salary_min") private Integer salaryMin;
    @Column(name = "salary_max") private Integer salaryMax;

    @Type(StringArrayType.class)
    @Column(columnDefinition = "text[]")
    private String[] sectors;

    @Column(name = "freshness_hours") private Integer freshnessHours;
    @Column(name = "min_match_percent") private Integer minMatchPercent;
    @Column(name = "sponsorship_required") private Boolean sponsorshipRequired;
    private Boolean onboarded;

    @Column(name = "updated_at") private Instant updatedAt;

    @PrePersist @PreUpdate void touch() { updatedAt = Instant.now(); }
}
