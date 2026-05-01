package com.careerops.model;

import io.hypersistence.utils.hibernate.type.array.StringArrayType;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "user_profiles", schema = "career_operations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserProfile {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    // ── Existing matching preference fields ──────────────────────────────────

    @Type(StringArrayType.class)
    @Column(name = "target_roles", columnDefinition = "text[]")
    private String[] targetRoles;

    @Type(StringArrayType.class)
    @Column(name = "tech_stack", columnDefinition = "text[]")
    private String[] techStack;

    private String location;

    @Column(name = "salary_min")  private Integer salaryMin;
    @Column(name = "salary_max")  private Integer salaryMax;

    @Type(StringArrayType.class)
    @Column(columnDefinition = "text[]")
    private String[] sectors;

    @Column(name = "freshness_hours")     private Integer freshnessHours;
    @Column(name = "min_match_percent")   private Integer minMatchPercent;
    @Column(name = "sponsorship_required") private Boolean sponsorshipRequired;
    private Boolean onboarded;

    // ── Section 10: Portfolio items (JSONB array) ────────────────────────────
    // Each element: { id, title, url, description, techTags: string[] }

    @Type(JsonType.class)
    @Column(name = "portfolio_items", columnDefinition = "jsonb")
    @Builder.Default
    private List<Map<String, Object>> portfolioItems = new java.util.ArrayList<>();

    // ── Section 10: Career goal fields ──────────────────────────────────────

    @Column(name = "goal_title",       length = 200) private String  goalTitle;
    @Column(name = "goal_salary_min")               private Integer goalSalaryMin;
    @Column(name = "goal_salary_max")               private Integer goalSalaryMax;
    @Column(name = "goal_location",    length = 100) private String  goalLocation;
    @Column(name = "open_to_remote")                private Boolean openToRemote;

    // ── Audit ─────────────────────────────────────────────────────────────────

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
