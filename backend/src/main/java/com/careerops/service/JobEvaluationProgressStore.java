package com.careerops.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread-safe SSE emitter registry.
 * Tracks one live SSE stream per user during the onboarding job evaluation pipeline.
 * Broadcasts per-source job counts and per-job evaluation progress in real time.
 */
@Component
public class JobEvaluationProgressStore {

    private static final Logger log = LoggerFactory.getLogger(JobEvaluationProgressStore.class);

    // One SseEmitter per active user session
    private final Map<UUID, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final Map<UUID, AtomicInteger> evaluatedCounts = new ConcurrentHashMap<>();
    private final Map<UUID, AtomicInteger> totalCounts = new ConcurrentHashMap<>();
    // userId -> sourceName -> jobCount
    private final Map<UUID, Map<String, Integer>> sourceCounts = new ConcurrentHashMap<>();

    /**
     * Register a new SSE emitter for a user. Call this when the frontend opens the stream
     * BEFORE clicking "Complete Profile" / triggering onboarding delivery.
     */
    public void registerEmitter(UUID userId, SseEmitter emitter) {
        emitters.put(userId, emitter);
        evaluatedCounts.put(userId, new AtomicInteger(0));
        totalCounts.put(userId, new AtomicInteger(0));
        sourceCounts.put(userId, new ConcurrentHashMap<>());

        emitter.onCompletion(() -> cleanup(userId));
        emitter.onTimeout(() -> {
            log.debug("SSE timeout for userId={}", userId);
            cleanup(userId);
        });
        emitter.onError(e -> {
            log.debug("SSE error for userId={}: {}", userId, e.getMessage());
            cleanup(userId);
        });
        log.debug("SSE emitter registered for userId={}", userId);
    }

    /** Set the total number of jobs that will be evaluated (after scraping merges). */
    public void setTotal(UUID userId, int total) {
        AtomicInteger counter = totalCounts.get(userId);
        if (counter != null) {
            counter.set(total);
        }
    }

    /**
     * Called once per source after scraping completes for that source.
     * Broadcasts SOURCE_FOUND event to the frontend.
     */
    public void recordSourceFound(UUID userId, String source, int count) {
        sourceCounts.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(source, count);
        int total = totalCounts.getOrDefault(userId, new AtomicInteger(0)).get();
        pushEvent(userId, buildJson("SOURCE_FOUND", source, count,
                evaluatedCounts.getOrDefault(userId, new AtomicInteger(0)).get(), total));
    }

    /**
     * Called after each individual job is evaluated.
     * Broadcasts JOB_EVALUATED event so the progress bar advances.
     */
    public void recordJobEvaluated(UUID userId, String source) {
        int evaluated = evaluatedCounts.getOrDefault(userId, new AtomicInteger(0)).incrementAndGet();
        int total = totalCounts.getOrDefault(userId, new AtomicInteger(0)).get();
        pushEvent(userId, buildJson("JOB_EVALUATED", source, 0, evaluated, total));
    }

    /**
     * Called after all jobs are evaluated and saved.
     * Sends COMPLETE event and closes the stream so the frontend auto-navigates to dashboard.
     */
    public void markComplete(UUID userId, int totalEvaluated) {
        pushEvent(userId, String.format(
                "{\"status\":\"COMPLETE\",\"evaluated\":%d,\"total\":%d,\"message\":\"All jobs evaluated — loading your dashboard\"}",
                totalEvaluated, totalEvaluated));
        SseEmitter emitter = emitters.get(userId);
        if (emitter != null) {
            try {
                emitter.complete();
            } catch (Exception ignored) {
            }
        }
        cleanup(userId);
    }

    /** Returns true if there is an active SSE listener for this user. */
    public boolean hasListener(UUID userId) {
        return emitters.containsKey(userId);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private void pushEvent(UUID userId, String json) {
        SseEmitter emitter = emitters.get(userId);
        if (emitter == null) return;
        try {
            emitter.send(SseEmitter.event().name("progress").data(json));
        } catch (Exception e) {
            log.debug("SSE send failed for userId={}, cleaning up: {}", userId, e.getMessage());
            cleanup(userId);
        }
    }

    private static String buildJson(String status, String source, int count, int evaluated, int total) {
        return String.format(
                "{\"status\":\"%s\",\"source\":\"%s\",\"count\":%d,\"evaluated\":%d,\"total\":%d}",
                status, source == null ? "" : source, count, evaluated, total);
    }

    private void cleanup(UUID userId) {
        emitters.remove(userId);
        evaluatedCounts.remove(userId);
        totalCounts.remove(userId);
        sourceCounts.remove(userId);
    }
}
