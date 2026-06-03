package com.careerops.service;

import com.careerops.dto.SkillStartRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Executes any career-ops skill using bundled SKILL.md + reference docs + injected DB context.
 * Replaces the generic NvidiaAgentService tool loop and inline handler system prompts.
 */
@Service
public class SkillMdExecutorService {

    private static final Logger log = LoggerFactory.getLogger(SkillMdExecutorService.class);

    private final SkillPromptLibrary prompts;
    private final SkillExecutionContextBuilder contextBuilder;
    private final NvidiaService nvidia;
    private final ObjectMapper mapper;

    public SkillMdExecutorService(
            SkillPromptLibrary prompts,
            SkillExecutionContextBuilder contextBuilder,
            NvidiaService nvidia,
            ObjectMapper mapper) {
        this.prompts = prompts;
        this.contextBuilder = contextBuilder;
        this.nvidia = nvidia;
        this.mapper = mapper;
    }

    public boolean isAvailable() {
        return nvidia.isConfigured();
    }

    /**
     * Run skill per SKILL.md. Returns parsed JSON ready for persistence.
     */
    public JsonNode execute(String skill, UUID userId, UUID userJobId, SkillStartRequest req) {
        return execute(skill, userId, userJobId, req, null);
    }

    public JsonNode execute(
            String skill,
            UUID userId,
            UUID userJobId,
            SkillStartRequest req,
            String supplementalUserContext) {
        String system = prompts.buildBackendSkillSystemPrompt(skill, userId);
        String user = contextBuilder.buildUserMessage(skill, userId, userJobId, req);
        if (supplementalUserContext != null && !supplementalUserContext.isBlank()) {
            user = user + "\n\n" + supplementalUserContext.trim() + "\n";
        }
        log.info("SkillMdExecutor: skill={} userId={} userJobId={} systemChars={} userChars={}",
            skill, userId, userJobId, system.length(), user.length());
        JsonNode raw = nvidia.generateJson(system, user, userId, "skill-" + skill);
        ObjectNode out = raw != null && raw.isObject()
            ? (ObjectNode) raw.deepCopy()
            : mapper.createObjectNode();
        if (raw != null && raw.isTextual()) {
            out.put("summary", raw.asText());
        }
        out.put("mode", "skill_md");
        out.put("skill", skill);
        return out;
    }
}
