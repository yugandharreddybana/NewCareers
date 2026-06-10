package com.careerops.service;

import com.careerops.model.SkillRun;
import com.careerops.model.UserJob;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * DB-backed AI Evaluation Cache — stores LIGHT_SCORE and DEEP_EVAL results
 * in the skill_runs table via SkillRunRepository.
 *
 * Cache keys use {@code user_jobs.id} (not {@code jobs.id}) so rows satisfy the
 * {@code user_job_id} FK and align with skill-run lookups elsewhere.
 *
 * Writes run in {@code REQUIRES_NEW} so a constraint/flush failure cannot roll
 * back the caller's transaction (e.g. GET /jobs/{userJobId}).
 */
@Service
@Slf4j
public class AiEvalCacheService {

    private static final String EVAL_TYPE_LIGHT = "LIGHT_SCORE";
    private static final String EVAL_TYPE_DEEP   = "DEEP_EVAL";
    private static final int    CACHE_TTL_HOURS  = 24;

    private final SkillRunRepository skillRunRepository;
    private final UserJobRepository userJobRepository;
    private final ObjectMapper mapper;

    public AiEvalCacheService(
            SkillRunRepository skillRunRepository,
            UserJobRepository userJobRepository,
            ObjectMapper mapper) {
        this.skillRunRepository = skillRunRepository;
        this.userJobRepository = userJobRepository;
        this.mapper = mapper;
        log.info("[EvalCache] Postgres-backed eval cache initialised (TTL={}h)", CACHE_TTL_HOURS);
    }

    /**
     * @param jobId {@code jobs.id} — resolved to {@code user_jobs.id} for storage.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public String get(UUID userId, UUID jobId, String evalType) {
        UUID userJobId = resolveUserJobId(userId, jobId);
        if (userJobId == null) {
            return null;
        }
        try {
            return skillRunRepository
                    .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, evalType)
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
     * @param jobId {@code jobs.id} — resolved to {@code user_jobs.id} for storage.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void put(UUID userId, UUID jobId, String evalType, String json) {
        UUID userJobId = resolveUserJobId(userId, jobId);
        if (userJobId == null) {
            log.debug("[EvalCache] put skipped — no user_jobs row userId={} jobId={}", userId, jobId);
            return;
        }
        try {
            JsonNode output = mapper.readTree(json);
            SkillRun run = SkillRun.builder()
                    .userId(userId)
                    .userJobId(userJobId)
                    .skill(evalType)
                    .input(mapper.createObjectNode())
                    .output(output)
                    .expiresAt(Instant.now().plus(CACHE_TTL_HOURS, ChronoUnit.HOURS))
                    .build();
            skillRunRepository.save(run);
            log.debug("[EvalCache] put userId={} userJobId={} evalType={}", userId, userJobId, evalType);
        } catch (Exception e) {
            log.warn("[EvalCache] put failed userId={} jobId={} evalType={}: {}",
                    userId, jobId, evalType, e.getMessage());
        }
    }

    public boolean isCached(UUID userId, UUID jobId, String evalType) {
        return get(userId, jobId, evalType) != null;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void invalidate(UUID userId, UUID jobId) {
        UUID userJobId = resolveUserJobId(userId, jobId);
        if (userJobId == null) {
            return;
        }
        try {
            skillRunRepository.deleteByUserIdAndUserJobIdAndSkill(userId, userJobId, EVAL_TYPE_LIGHT);
            skillRunRepository.deleteByUserIdAndUserJobIdAndSkill(userId, userJobId, EVAL_TYPE_DEEP);
            log.debug("[EvalCache] invalidated userId={} userJobId={}", userId, userJobId);
        } catch (Exception e) {
            log.warn("[EvalCache] invalidate failed userId={} jobId={}: {}",
                    userId, jobId, e.getMessage());
        }
    }

    public void putLight(UUID userId, UUID jobId, int matchPercent) {
        try {
            ObjectNode node = mapper.createObjectNode();
            node.put("matchPercent", matchPercent);
            put(userId, jobId, EVAL_TYPE_LIGHT, mapper.writeValueAsString(node));
        } catch (Exception e) {
            log.warn("[EvalCache] putLight failed userId={} jobId={}: {}", userId, jobId, e.getMessage());
        }
    }

    public int getLight(UUID userId, UUID jobId) {
        try {
            String json = get(userId, jobId, EVAL_TYPE_LIGHT);
            if (json == null) return -1;
            JsonNode node = mapper.readTree(json);
            return node.path("matchPercent").asInt(-1);
        } catch (Exception e) {
            log.warn("[EvalCache] getLight parse failed userId={} jobId={}: {}", userId, jobId, e.getMessage());
            return -1;
        }
    }

    public void putDeep(UUID userId, UUID jobId, JsonNode report) {
        try {
            put(userId, jobId, EVAL_TYPE_DEEP, mapper.writeValueAsString(report));
        } catch (Exception e) {
            log.warn("[EvalCache] putDeep failed userId={} jobId={}: {}", userId, jobId, e.getMessage());
        }
    }

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

    public void evict(UUID userId, UUID jobId) {
        invalidate(userId, jobId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
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

    private UUID resolveUserJobId(UUID userId, UUID jobId) {
        return userJobRepository.findByUserIdAndJobId(userId, jobId)
                .map(UserJob::getId)
                .orElse(null);
    }
}
