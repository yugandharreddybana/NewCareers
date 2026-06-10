package com.careerops.service.skills;

import com.careerops.dto.SkillRunResponse;
import com.careerops.model.AgentResult;
import com.careerops.model.SkillRun;
import com.careerops.repository.SkillRunRepository;
import com.careerops.service.SkillLocalFallbackService;
import com.careerops.service.SkillRunCachePolicy;
import com.careerops.service.SkillRunVersionPolicy;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Dispatches Phase 2 skill execution to the correct SkillHandler.
 *
 * Phase 2 skills bypass the agentic tool loop and instead use
 * NvidiaService via their dedicated handlers — faster, cheaper,
 * and fully deterministic structured output.
 *
 * All 5 Phase 2 handlers are auto-discovered via Spring's List<SkillHandler> injection.
 */
@Service
public class SkillHandlerRegistry {

    private static final Logger log = LoggerFactory.getLogger(SkillHandlerRegistry.class);

    /** Phase 2 skill names — all routed through this registry */
    public static final Set<String> PHASE2_SKILLS = Set.of(
        "salary-negotiation",
        "culture-fit",
        "linkedin-optimize",
        "cover-letter",
        "skills-gap-plan"
    );

    private final Map<String, SkillHandler> handlers;
    private final SkillRunRepository        skillRuns;
    private final SkillLocalFallbackService localFallback;
    private final ObjectMapper              mapper;
    private final TransactionTemplate       writeTx;

    public SkillHandlerRegistry(
            List<SkillHandler> handlerList,
            SkillRunRepository skillRuns,
            SkillLocalFallbackService localFallback,
            ObjectMapper mapper,
            PlatformTransactionManager transactionManager) {
        this.handlers  = handlerList.stream()
                .collect(Collectors.toMap(SkillHandler::skillName, Function.identity()));
        this.skillRuns = skillRuns;
        this.localFallback = localFallback;
        this.mapper = mapper;
        this.writeTx = new TransactionTemplate(transactionManager);
        this.writeTx.setTimeout(15);
        log.info("SkillHandlerRegistry: registered {} Phase 2 handlers: {}",
                this.handlers.size(), this.handlers.keySet());
    }

    /**
     * Returns true if the given skill name is a Phase 2 skill handled by this registry.
     */
    public boolean handles(String skillName) {
        return PHASE2_SKILLS.contains(skillName);
    }

    /**
     * Executes the skill (cache lookup is handled by SkillService before routing here):
     *   1. Dispatch to handler (outside DB transaction — AI may take minutes)
     *   2. Persist result as SkillRun
     *   3. Return SkillRunResponse
     */
    public SkillRunResponse execute(String skillName, UUID userId, UUID userJobId, Boolean forceRefresh) {
        log.info("SkillHandlerRegistry.execute: skill={}, userId={}, userJobId={}, forceRefresh={}",
                skillName, userId, userJobId, forceRefresh);

        SkillHandler handler = handlers.get(skillName);
        if (handler == null) {
            log.error("No handler registered for skill: {}", skillName);
            return SkillRunResponse.error(skillName,
                    "Skill '" + skillName + "' is not available. Please contact support.");
        }

        JsonNode output;
        int totalTokens = 0;
        try {
            SkillHandlerResult result = handler.execute(userId, userJobId);
            output = result.output();
            totalTokens = result.totalTokens();
        } catch (Exception e) {
            log.warn("Handler failed for skill={}, trying local fallback: {}", skillName, e.getMessage());
            output = localFallback.tryFallback(skillName, userId, userJobId, null)
                .filter(r -> r instanceof AgentResult.Done)
                .map(r -> parseFallbackJson((AgentResult.Done) r))
                .orElse(null);
            if (output == null) {
                return SkillRunResponse.error(skillName,
                        "Skill execution failed. Please try again. (" + e.getMessage() + ")");
            }
        }

        if (output.has("error") && output.size() == 1) {
            return SkillRunResponse.error(skillName, output.path("error").asText());
        }

        final JsonNode persistedOutput = output;
        final int persistedTokens = totalTokens > 0
                ? totalTokens
                : output.path("tokensUsed").asInt(0);

        SkillRun run = new SkillRun();
        run.setUserId(userId);
        run.setUserJobId(userJobId);
        run.setSkill(skillName);
        run.setOutput(persistedOutput);
        run.setExpiresAt(SkillRunCachePolicy.computeExpiry(skillName));
        if (persistedTokens > 0) {
            run.setTotalTokens(persistedTokens);
        }

        writeTx.executeWithoutResult(status -> {
            skillRuns.save(run);
            if (SkillRunVersionPolicy.isVersioned(skillName) && userJobId != null) {
                pruneOldVersions(userId, userJobId, skillName);
            }
        });

        log.info("Phase 2 skill={} completed and persisted for userId={} tokens={}",
                skillName, userId, persistedTokens);
        return SkillRunResponse.result(skillName, persistedOutput);
    }

    private void pruneOldVersions(UUID userId, UUID userJobId, String skill) {
        List<SkillRun> runs = skillRuns.findByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(
                userId, userJobId, skill,
                PageRequest.of(0, SkillRunVersionPolicy.MAX_VERSIONS + 5));
        if (runs.size() <= SkillRunVersionPolicy.MAX_VERSIONS) {
            return;
        }
        runs.subList(SkillRunVersionPolicy.MAX_VERSIONS, runs.size()).forEach(skillRuns::delete);
    }

    private JsonNode parseFallbackJson(AgentResult.Done done) {
        try {
            return mapper.readTree(done.text());
        } catch (Exception e) {
            var node = mapper.createObjectNode();
            node.put("summary", done.text());
            return node;
        }
    }
}
