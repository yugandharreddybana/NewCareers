package com.careerops.model;

import io.hypersistence.utils.hibernate.type.array.StringArrayType;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Section 10 — Task 105
 * Added: portfolioItems (JSONB), goal_title, goal_salary_min, goal_salary_max,
 *        goal_location, open_to_remote
 */
@Entity
@Table(name = "user_profiles", schema = "career_operations",
       uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserProfile {

    public static final int DEFAULT_MIN_MATCH_PERCENT = 60;

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    // ── Existing matching prefs ──────────────────────────────────────────

    @Type(StringArrayType.class)
    @Column(name = "target_roles", columnDefinition = "text[]")
    private String[] targetRoles;

    @Type(StringArrayType.class)
    @Column(name = "tech_stack", columnDefinition = "text[]")
    private String[] techStack;

    private String location;

    @Column(name = "salary_min")     private Integer salaryMin;
    @Column(name = "salary_max")     private Integer salaryMax;
    @Builder.Default
    @Column(name = "salary_currency") private String salaryCurrency = "EUR";

    @Type(StringArrayType.class)
    @Column(name = "sectors", columnDefinition = "text[]")
    private String[] sectors;

    @Column(name = "freshness_hours")   private Integer freshnessHours;
    @Column(name = "min_match_percent") private Integer minMatchPercent;
    @Column(name = "sponsorship_required") private Boolean sponsorshipRequired;
    private Boolean onboarded;

    // ── Section 10: Portfolio items (JSONB array) ────────────────────────

    /**
     * Each element: { id, title, url, description, techTags[] }
     * Stored as JSONB; managed via ProfileService portfolio CRUD.
     */
    @Type(JsonType.class)
    @Column(name = "portfolio_items", columnDefinition = "jsonb")
    @Builder.Default
    @jakarta.validation.Valid
    private List<PortfolioItem> portfolioItems = new ArrayList<>();

    // ── Section 10: Career Goal fields ──────────────────────────────────

    @Column(name = "goal_title",      length = 200) private String  goalTitle;
    @Column(name = "goal_salary_min")               private Integer goalSalaryMin;
    @Column(name = "goal_salary_max")               private Integer goalSalaryMax;
    @Column(name = "goal_location",   length = 100) private String  goalLocation;
    @Column(name = "open_to_remote")                private Boolean openToRemote;

    @Column(name = "updated_at") private Instant updatedAt;

    @PrePersist @PreUpdate
    void touch() { updatedAt = Instant.now(); }

    // ── Embedded value object ────────────────────────────────────────────

    /**
     * Serialised as one element of the portfolio_items JSONB array.
     * Must be a plain serialisable class (no JPA annotations needed).
     */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PortfolioItem {
        private String       id;          // client-generated UUID string

        @jakarta.validation.constraints.NotBlank(message = "Title is required")
        @jakarta.validation.constraints.Size(max = 100, message = "Title cannot exceed 100 characters")
        private String       title;

        @jakarta.validation.constraints.Size(max = 255, message = "URL cannot exceed 255 characters")
        @org.hibernate.validator.constraints.URL(message = "Invalid URL format")
        private String       url;

        @jakarta.validation.constraints.Size(max = 1000, message = "Description cannot exceed 1000 characters")
        private String       description;

        private List<String> techTags;
    }
}
