package com.careerops.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.UUID;

/**
 * Persisted output of a completed skill run.
 *
 * Acts as both an audit log and a TTL cache.
 * Cache lookup checks that expiresAt is null (never expire) or in the future.
 *
 * TTL by skill:
 *   evaluate       = 7 days  (re-evaluate if job changes)
 *   research        = 1 day   (company news changes frequently)
 *   prep-interview  = 3 days
 *   tailor-resume   = no cache (always fresh per application)
 *   outreach        = no cache (channel/tone variants differ)
 *   apply           = no cache (always fresh)
 *   compare         = no cache (job selection varies)
 *   triage          = no cache (queue changes between runs)
 *   scan            = no cache (fresh data each time)
 */
@Entity
@Table(
    name = "skill_runs",
    schema = "careerops",
    indexes = {
        @Index(name = "idx_skill_runs_user_job_skill_date",
               columnList = "user_id, user_job_id, skill, created_at DESC")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Owner. All cache queries MUST include this to prevent cross-user data leaks. */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** The UserJob this skill ran against. Null for queue-level skills (triage, compare). */
    @Column(name = "user_job_id")
    private UUID userJobId;

    /** Skill name: evaluate | tailor-resume | apply | outreach | research | prep-interview | compare | triage | scan */
    @Column(name = "skill", nullable = false)
    private String skill;

    /** Input context snapshot (for debugging/audit). Not returned to frontend. */
    @Type(JsonType.class)
    @Column(name = "input", columnDefinition = "jsonb")
    private JsonNode input;

    /** Structured output from Claude. Returned to frontend via SkillRunResponse. */
    @Type(JsonType.class)
    @Column(name = "output", columnDefinition = "jsonb")
    private JsonNode output;

    /**
     * Cache expiry. NULL = never expires.
     * Checked by SkillService cache lookup before running Claude again.
     */
    @Column(name = "expires_at")
    private Instant expiresAt;

    /**
     * ATS-formatted HTML resume from tailor-resume skill.
     * Served ONLY via the PDF download endpoint — never exposed directly in API responses.
     * Stored here AND in Supabase for redundancy.
     */
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "resume_html", columnDefinition = "TEXT")
    @JsonIgnore
    private String resumeHtml;

    /**
     * Supabase storage path for the resume file.
     * Format: {userId}/{company-slug}-{role-slug}.html
     */
    @Column(name = "resume_filename")
    private String resumeFilename;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

