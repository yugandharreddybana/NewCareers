package com.careerops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Request body for POST /api/skills/conversation/reply
 * Sent when the user answers a question from Claude's ask_user tool.
 */
public record ConversationReplyRequest(

    /** The skill_conversations.id returned in the previous SkillRunResponse */
    @NotNull(message = "conversationId is required")
    UUID conversationId,

    /**
     * The user's answer to Claude's question.
     * Empty string is valid (user clicked Skip).
     */
    @NotBlank(message = "answer is required — send empty string for Skip")
    String answer
) {}
