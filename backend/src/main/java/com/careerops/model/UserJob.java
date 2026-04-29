package com.careerops.model;

import com.fasterxml.jackson.databind.JsonNode;
import io.hypersistence.utils.hibernate.type.array.StringArrayType;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_jobs", schema = "career_operations",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id","job_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserJob {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "job_id",  nullable = false) private UUID jobId;

    @Column(name = "ai_score") private Integer aiScore;
    @Column(name = "match_percent") private Integer matchPercent;

    @Type(StringArrayType.class)
    @Column(name = "matched_skills", columnDefinition = "text[]")
    private String[] matchedSkills;

    @Type(StringArrayType.class)
    @Column(name = "unmatched_skills", columnDefinition = "text[]")
    private String[] unmatchedSkills;

    @Type(StringArrayType.class)
    @Column(name = "cv_improvement_tips", columnDefinition = "text[]")
    private String[] cvImprovementTips;

    @Type(JsonBinaryType.class)
    @Column(name = "score_breakdown", columnDefinition = "jsonb")
    private JsonNode scoreBreakdown;

    @Column(name = "human_summary") private String humanSummary;
    private String verdict;

    @Column(name = "delivered_at") private Instant deliveredAt;
    private String status;
    @Column(name = "kanban_column") private String kanbanColumn;

    @PrePersist void onCreate() {
        if (deliveredAt == null) deliveredAt = Instant.now();
        if (status == null) status = "new";
        if (kanbanColumn == null) kanbanColumn = "Discovered";
    }
}
