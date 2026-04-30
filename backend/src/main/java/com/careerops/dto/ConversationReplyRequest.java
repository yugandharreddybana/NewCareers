package com.careerops.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/**
 * Request body for POST /api/skills/conversation/reply
 *
 * Sent when the user responds to a question that Claude asked via the ask_user tool.
 * The backend loads the saved SkillConversation, appends the user's answer as a
 * tool_result, and resumes the Claude agentic loop.
 */
@Data
public class ConversationReplyRequest {

    @NotNull(message = "conversationId is required")
    private UUID conversationId;

    /**
     * The user's answer to Claude's question.
     * Null or blank = user clicked "Skip" — Claude will be informed the question was skipped
     * and should proceed with whatever context it has.
     */
    private String answer;
}
