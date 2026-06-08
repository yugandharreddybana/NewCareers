package com.careerops.service;

import com.careerops.model.SkillRun;
import com.careerops.repository.SkillRunRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * DB-backed AI Evaluation Cache — stores LIGHT_SCORE and DEEP_EVAL results
 * in the skill_runs table via SkillRunRepository.
 *
 * Architecture:
 *   - Core primitives: get / put / isCached / invalidate
 *   - Facade methods: putLight / getLight / putDeep / getDeep / evict / evictAllForUser
 *     All facade methods delegate to core primitives so existing callers
 *     (ParallelJobEvaluationService, CvService) compile unchanged.
 *
 * TTL: 24 hours, enforced in the service layer (expiresAt > Instant.now()).
 * Skill column convention: "LIGHT_SCORE" / "DEEP_EVAL" (distinct from catalog skill names).
 *
 * All cache operations are wrapped in try/catch — a cache failure NEVER
 * propagates to the caller. Callers must handle null / -1 returns gracefully.
 */
@Service
@Slf4j
public class AiEvalCacheService {

    // ── Constants ─────────────────────────────────────────────────────────────

    private static final String EVAL_TYPE_LIGHT = "LIGHT_SCORE";
    private static final String EVAL_TYPE_DEEP   = "DEEP_EVAL";
    private static final int    CACHE_TTL_HOURS  = 24;

    // ── Dependencies ──────────────────────────────────────────────────────────

    private final SkillRunRepository skillRunRepository;
    private final ObjectMapper mapper;

    public AiEvalCacheService(SkillRunRepository skillRunRepository, ObjectMapper mapper) {
        this.skillRunRepository = skillRunRepository;
        this.mapper = mapper;
        log.info("[EvalCache] Postgres-backed eval cache initialised (TTL={}h)", CACHE_TTL_HOURS);
    }

    // ════════════════════════════════════════════════════════════════════════
    // CORE PRIMITIVES
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Retrieve a cached eval result as a raw JSON string.
     * Returns null if no valid (non-expired) cache entry exists.
     */
    public String get(UUID userId, UUID jobId, String evalType) {
        try {
            return skillRunRepository
                    .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, jobId, evalType)
                    .filter(run -> run.getExpiresAt() != null && run.getExpiresAt().isAfter(Instant.now()))
                    .map(run -> {
                        try {
                            return mapper.writeValueAsString(run.getOutput());
                        } catch (Exception e) {
                            log.warn("[EvalCache] serialize failed userId={} evalType={}: {}",
                                    userId, evalType, e.getMessage());
                            return null;
                        }
                    })
                    .orElse(null);
        } catch (Exception e) {
            log.warn("[EvalCache] get failed userId={} jobId={} evalType={}: {}",
                    userId, jobId, evalType, e.getMessage());
            return null;
        }
    }

    /**
     * Store an eval result. Always inserts a new row — invalidate/nightly purge handles cleanup.
     */
    public void put(UUID userId, UUID jobId, String evalType, String json) {
        try {
            JsonNode output = mapper.readTree(json);
            SkillRun run = SkillRun.builder()
                    .userId(userId)
                    .userJobId(jobId)
                    .skill(evalType)
                    .input(mapper.createObjectNode())
                    .output(output)
                    .expiresAt(Instant.now().plus(CACHE_TTL_HOURS, ChronoUnit.HOURS))
                    .build();
            skillRunRepository.save(run);
            log.debug("[EvalCache] put userId={} jobId={} evalType={}", userId, jobId, evalType);
        } catch (Exception e) {
            log.warn("[EvalCache] put failed userId={} jobId={} evalType={}: {}",
                    userId, jobId, evalType, e.getMessage());
        }
    }

    /**
     * Returns true if a non-expired cache entry exists for the given key.
     */
    public boolean isCached(UUID userId, UUID jobId, String evalType) {
        return get(userId, jobId, evalType) != null;
    }

    /**
     * Evict both LIGHT_SCORE and DEEP_EVAL rows for a (user, job) pair.
     */
    public void invalidate(UUID userId, UUID jobId) {
        try {
            skillRunRepository.deleteByUserIdAndUserJobIdAndSkill(userId, jobId, EVAL_TYPE_LIGHT);
            skillRunRepository.deleteByUserIdAndUserJobIdAndSkill(userId, jobId, EVAL_TYPE_DEEP);
            log.debug("[EvalCache] invalidated userId={} jobId={}", userId, jobId);
        } catch (Exception e) {
            log.warn("[EvalCache] invalidate failed userId={} jobId={}: {}",
                    userId, jobId, e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // FACADE API — delegates to core primitives, callers unchanged
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Store a LIGHT score (matchPercent only) for the feed.
     * Keyed as LIGHT_SCORE in skill_runs.
     */
    public void putLight(UUID userId, UUID jobId, int matchPercent) {
        try {
            ObjectNode node = mapper.createObjectNode();
            node.put("matchPercent", matchPercent);
            put(userId, jobId, EVAL_TYPE_LIGHT, mapper.writeValueAsString(node));
        } catch (Exception e) {
            log.warn("[EvalCache] putLight failed userId={} jobId={}: {}", userId, jobId, e.getMessage());
        }
    }

    /**
     * Get cached light score for feed. Returns -1 if missing or expired.
     */
    public int getLight(UUID userId, UUID jobId) {
        try {
            String json = get(userId, jobId, EVAL_TYPE_LIGHT);
            if (json == null) return -1;
            JsonNode node = mapper.readTree(json);
            int score = node.path("matchPercent").asInt(-1);
            return score;
        } catch (Exception e) {
            log.warn("[EvalCache] getLight parse failed userId={} jobId={}: {}", userId, jobId, e.getMessage());
            return -1;
        }
    }

    /**
     * Store a full DEEP evaluation report for job-open / PDF path.
     * Keyed as DEEP_EVAL in skill_runs.
     */
    public void putDeep(UUID userId, UUID jobId, JsonNode report) {
        try {
            put(userId, jobId, EVAL_TYPE_DEEP, mapper.writeValueAsString(report));
        } catch (Exception e) {
            log.warn("[EvalCache] putDeep failed userId={} jobId={}: {}", userId, jobId, e.getMessage());
        }
    }

    /**
     * Get cached deep evaluation report. Returns null if missing or expired.
     */
    public JsonNode getDeep(UUID userId, UUID jobId) {
        try {
            String json = get(userId, jobId, EVAL_TYPE_DEEP);
            if (json == null) return null;
            return mapper.readTree(json);
        } catch (Exception e) {
            log.warn("[EvalCache] getDeep parse failed userId={} jobId={}: {}", userId, jobId, e.getMessage());
            return null;
        }
    }

    /**
     * Invalidate both light and deep entries for a (user, job) pair.
     * Call this when the user's CV changes or the job is re-evaluated explicitly.
     */
    public void evict(UUID userId, UUID jobId) {
        invalidate(userId, jobId);
    }

    /**
     * Evict all LIGHT_SCORE and DEEP_EVAL cache entries for a user.
     * Called by CvService after a CV update.
     *
     * Uses only existing repo methods — does NOT call a bulk deleteAllByUserId
     * (that would wipe real skill outputs like evaluate, tailor-resume, etc.).
     */
    public void evictAllForUser(UUID userId) {
        try {
            skillRunRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                    .filter(r -> EVAL_TYPE_LIGHT.equals(r.getSkill()) || EVAL_TYPE_DEEP.equals(r.getSkill()))
                    .forEach(r -> {
                        try {
                            skillRunRepository.deleteByUserIdAndUserJobIdAndSkill(
                                    r.getUserId(), r.getUserJobId(), r.getSkill());
                        } catch (Exception inner) {
                            log.warn("[EvalCache] evictAllForUser row delete failed userId={} skill={}: {}",
                                    userId, r.getSkill(), inner.getMessage());
                        }
                    });
            log.info("[EvalCache] evictAllForUser completed for userId={}", userId);
        } catch (Exception e) {
            log.warn("[EvalCache] evictAllForUser failed userId={}: {}", userId, e.getMessage());
        }
    }
}
