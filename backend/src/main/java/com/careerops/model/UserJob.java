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
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id","job_id"}),
       indexes = {
           @Index(name = "idx_user_jobs_user_delivered", columnList = "user_id, delivered_at DESC"),
           @Index(name = "idx_user_jobs_user_kanban", columnList = "user_id, kanban_column")
       })
@org.hibernate.annotations.SQLRestriction("deleted_at IS NULL")
@org.hibernate.annotations.SQLDelete(sql = "UPDATE career_operations.user_jobs SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@org.hibernate.annotations.DynamicUpdate
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserJob {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Version private Long version;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "job_id",  nullable = false) private UUID jobId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", insertable = false, updatable = false)
    private Job job;

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

    @Basic(fetch = FetchType.LAZY)
    @Type(JsonBinaryType.class)
    @Column(name = "score_breakdown", columnDefinition = "jsonb")
    private JsonNode scoreBreakdown;

    @Column(name = "human_summary") private String humanSummary;
    private String verdict;
    private String notes;

    @Column(name = "delivered_at") private Instant deliveredAt;
    private String status;
    @Column(name = "kanban_column") private String kanbanColumn;
    @Column(name = "deleted_at") private Instant deletedAt;

    public void setStatus(String status) {
        this.status = status;
        this.kanbanColumn = status;
    }

    public void setKanbanColumn(String kanbanColumn) {
        this.kanbanColumn = kanbanColumn;
        this.status = kanbanColumn;
    }

    @PrePersist void onCreate() {
        if (deliveredAt == null) deliveredAt = Instant.now();
        if (status == null) status = "Discovered";
        if (kanbanColumn == null) kanbanColumn = "Discovered";
    }
}
