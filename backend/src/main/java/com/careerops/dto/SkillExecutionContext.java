package com.careerops.dto;

import java.util.UUID;

/**
 * Pre-loaded profile/CV/job context for agent system-prompt injection.
 * Produced by {@link com.careerops.service.SkillExecutionContextBuilder#build}.
 */
public record SkillExecutionContext(
        UUID userId,
        UUID userJobId,
        String skillName,
        String inlineContext
) {
    public String toInlineContext() {
        return inlineContext;
    }
}
