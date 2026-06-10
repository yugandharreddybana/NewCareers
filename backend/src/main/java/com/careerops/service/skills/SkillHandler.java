package com.careerops.service.skills;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Contract for Phase 2 skill handlers — each delegates to {@link SkillMdExecutorService}
 * using bundled SKILL.md + reference docs.
 */
public interface SkillHandler {

    /**
     * The skill name this handler is responsible for.
     * Must match the value used in SkillPromptLibrary and skill_runs.skill column.
     */
    String skillName();

    /**
     * Execute the skill for the given user and job context.
     *
     * @param userId    Authenticated user's UUID
     * @param userJobId The UserJob UUID (may be null for job-agnostic skills)
     * @return Structured JSON output and token usage for persistence
     */
    SkillHandlerResult execute(UUID userId, UUID userJobId);
}
