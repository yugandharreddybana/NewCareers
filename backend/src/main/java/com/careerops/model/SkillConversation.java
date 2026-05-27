package com.careerops.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Represents a paused Claude agentic skill run awaiting user input.
 *
 * When Claude calls the ask_user tool mid-skill, the full conversation state
 * is saved here so that when the user replies, the skill can resume from
 * exactly the same point in the agentic loop.
 *
 * Rows expire after `skill.conversation.expire.minutes` (default 30 min).
 * The SkillConversationCleanupJob purges expired rows every 15 minutes.
 */
@Entity
@Table(
    name = "skill_conversations",
    schema = "careerops",
    indexes = {
        @Index(name = "idx_skill_conv_user_status", columnList = "user_id, status"),
        @Index(name = "idx_skill_conv_expires",     columnList = "expires_at"),
        @Index(name = "idx_skill_conv_user_skill_status", columnList = "user_id, skill, status")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Owner of this conversation. All queries MUST include this to prevent data leaks. */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** The UserJob this skill was run for. Null for triage/compare (queue-level skills). */
    @Column(name = "user_job_id")
    private UUID userJobId;

    /** Skill name: evaluate | tailor-resume | apply | outreach | research | prep-interview | compare | triage | scan */
    @Column(name = "skill", nullable = false)
    private String skill;

    /**
     * Full Claude Messages API conversation history as JSONB.
     * Includes all system, user, assistant, and tool_result messages up to the pause point.
     * Never returned via any API endpoint — only used internally to resume the loop.
     */
    @Type(JsonType.class)
    @Column(name = "messages", columnDefinition = "jsonb", nullable = false)
    @JsonIgnore
    private JsonNode messages;

    /** pending_answer | completed | error */
    @Column(name = "status", nullable = false)
    @Builder.Default
    private String status = "pending_answer";

    /** The exact question Claude asked the user. Displayed in the SkillQuestionModal. */
    @Column(name = "question", columnDefinition = "TEXT")
    private String question;

    /**
     * Claude's tool_use_id for the pending ask_user call.
     * Must be included in the tool_result message when resuming.
     */
    @Column(name = "tool_use_id")
    private String toolUseId;

    /** Conversation becomes invalid after this time. Set to now + 30 minutes on creation. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

