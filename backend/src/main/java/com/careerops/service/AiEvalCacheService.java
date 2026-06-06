package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Batch 3 — AI Evaluation Cache Service
 *
 * Previously used an in-memory ConcurrentHashMap. SkillService and job evaluation
 * now rely on DB-backed caching via SkillRunRepository / skill_runs.
 *
 * Public API retained for CvService, ParallelJobEvaluationService, JobDeliveryService
 * until wired to DB or Redis.
 *
 * TTL default: 6 hours. Configurable via ai.eval.cache.ttl.hours.
 */
@Service
@Slf4j
public class AiEvalCacheService {

    private final ObjectMapper mapper;

    @Value("${ai.eval.cache.ttl.hours:6}")
    private int ttlHours;

    public AiEvalCacheService(ObjectMapper mapper) {
        this.mapper = mapper;
        log.debug("[EvalCache] in-memory cache removed - DB-backed caching via SkillRunRepository is used");
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Store a LIGHT score (matchPercent only) for the feed.
     * Keyed as: eval::light::{userId}::{jobId}
     */
    public void putLight(UUID userId, UUID jobId, int matchPercent) {
        // TODO: wire to DB or Redis
    }

    /**
     * Get cached light score for feed. Returns -1 if missing or expired.
     */
    public int getLight(UUID userId, UUID jobId) {
        // TODO: wire to DB or Redis
        return -1;
    }

    /**
     * Store a full DEEP evaluation report for job-open / PDF path.
     * Keyed as: eval::deep::{userId}::{jobId}
     */
    public void putDeep(UUID userId, UUID jobId, JsonNode report) {
        // TODO: wire to DB or Redis
    }

    /**
     * Get cached deep evaluation report. Returns null if missing or expired.
     */
    public JsonNode getDeep(UUID userId, UUID jobId) {
        // TODO: wire to DB or Redis
        return null;
    }

    /**
     * Invalidate both light and deep entries for a (user, job) pair.
     * Call this when the user's CV changes or the job is re-evaluated explicitly.
     */
    public void evict(UUID userId, UUID jobId) {
        // TODO: wire to DB or Redis
    }

    /**
     * Evict all cache entries for a user (e.g. after CV update).
     */
    public void evictAllForUser(UUID userId) {
        // TODO: wire to DB or Redis
    }
}
