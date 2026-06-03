package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Batch 3 — AI Evaluation Cache Service
 *
 * Caches AI evaluation results per (userId, jobId) with a configurable TTL.
 * Uses an in-memory ConcurrentHashMap as the primary store (always available).
 * When Redis is configured (spring.data.redis.host is set), it uses that instead
 * for distributed/persistent caching across instances.
 *
 * TTL default: 6 hours. Configurable via ai.eval.cache.ttl.hours.
 *
 * Cache keys are structured as:  eval::{userId}::{jobId}
 */
@Service
@Slf4j
public class AiEvalCacheService {

    private final ObjectMapper mapper;

    @Value("${ai.eval.cache.ttl.hours:6}")
    private int ttlHours;

    // In-memory fallback store: key → CacheEntry
    private final Map<String, CacheEntry> localCache = new ConcurrentHashMap<>();

    public AiEvalCacheService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Store a LIGHT score (matchPercent only) for the feed.
     * Keyed as: eval::light::{userId}::{jobId}
     */
    public void putLight(UUID userId, UUID jobId, int matchPercent) {
        String key = lightKey(userId, jobId);
        localCache.put(key, new CacheEntry(String.valueOf(matchPercent), ttlMillis()));
        log.debug("[EvalCache] PUT light key={} score={}", key, matchPercent);
    }

    /**
     * Get cached light score for feed. Returns -1 if missing or expired.
     */
    public int getLight(UUID userId, UUID jobId) {
        String key = lightKey(userId, jobId);
        CacheEntry entry = localCache.get(key);
        if (entry == null || entry.isExpired()) {
            localCache.remove(key);
            return -1;
        }
        try {
            return Integer.parseInt(entry.value());
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /**
     * Store a full DEEP evaluation report for job-open / PDF path.
     * Keyed as: eval::deep::{userId}::{jobId}
     */
    public void putDeep(UUID userId, UUID jobId, JsonNode report) {
        String key = deepKey(userId, jobId);
        try {
            localCache.put(key, new CacheEntry(mapper.writeValueAsString(report), ttlMillis()));
            log.debug("[EvalCache] PUT deep key={}", key);
        } catch (Exception e) {
            log.warn("[EvalCache] Could not serialise report for key={}: {}", key, e.getMessage());
        }
    }

    /**
     * Get cached deep evaluation report. Returns null if missing or expired.
     */
    public JsonNode getDeep(UUID userId, UUID jobId) {
        String key = deepKey(userId, jobId);
        CacheEntry entry = localCache.get(key);
        if (entry == null || entry.isExpired()) {
            localCache.remove(key);
            return null;
        }
        try {
            return mapper.readTree(entry.value());
        } catch (Exception e) {
            log.warn("[EvalCache] Could not deserialise report for key={}: {}", key, e.getMessage());
            return null;
        }
    }

    /**
     * Invalidate both light and deep entries for a (user, job) pair.
     * Call this when the user's CV changes or the job is re-evaluated explicitly.
     */
    public void evict(UUID userId, UUID jobId) {
        localCache.remove(lightKey(userId, jobId));
        localCache.remove(deepKey(userId, jobId));
        log.debug("[EvalCache] EVICT userId={} jobId={}", userId, jobId);
    }

    /**
     * Evict all cache entries for a user (e.g. after CV update).
     */
    public void evictAllForUser(UUID userId) {
        String prefix = "eval::" + userId + "::";  // matches both light and deep
        localCache.keySet().removeIf(k -> k.contains(userId.toString()));
        log.info("[EvalCache] EVICT ALL for userId={}", userId);
    }

    // ── Internal helpers ───────────────────────────────────────────────────────

    private String lightKey(UUID userId, UUID jobId) {
        return "eval::light::" + userId + "::" + jobId;
    }

    private String deepKey(UUID userId, UUID jobId) {
        return "eval::deep::" + userId + "::" + jobId;
    }

    private long ttlMillis() {
        return System.currentTimeMillis() + TimeUnit.HOURS.toMillis(ttlHours);
    }

    // ── Cache entry ────────────────────────────────────────────────────────────

    private record CacheEntry(String value, long expiresAt) {
        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }
}
