package com.careerops.service.skills;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.UUID;

/**
 * Contract for all Phase 2 skill handlers.
 *
 * Each handler:
 *   1. Fetches required context from the DB (profile, job, CV) via repositories
 *   2. Builds a rich user prompt injecting that context
 *   3. Calls ClaudeDirectService.generateJson() with the skill-specific system prompt
 *   4. Returns a validated JsonNode
 *
 * Handlers are registered in SkillHandlerRegistry and dispatched by SkillService.
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
     * @return Structured JSON output ready to be stored in skill_runs.output
     */
    JsonNode execute(UUID userId, UUID userJobId);
}
