package com.careerops.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * AI Provider Metrics Service
 *
 * Thread-safe in-memory metrics for each AI provider used by AiProviderRouter.
 *
 * B3-G5 NOTE: This service is now also injected into ApplicationPlannerService
 * and MockInterviewService so ALL Gemini/Claude calls across the system
 * record outcomes here, not just router calls.
 *
 * B3-G6 FIX: snapshot() is a public method exposed via
 * AdminController GET /admin/ai-provider/metrics.
 *
 * Tracked per provider:
 *   - totalCalls
 *   - successCount
 *   - failureCount
 *   - consecutiveFailures (reset on success)
 *   - totalLatencyMs / avgLatencyMs
 */
@Service
@Slf4j
public class AiProviderMetricsService {

    private final Map<String, ProviderStats> stats = new ConcurrentHashMap<>();

    // ── Public API ──────────────────────────────────────────────────────────

    public void recordSuccess(String provider, long latencyMs) {
        ProviderStats s = getOrCreate(provider);
        s.totalCalls.incrementAndGet();
        s.successCount.incrementAndGet();
        s.consecutiveFailures.set(0);
        s.totalLatencyMs.addAndGet(latencyMs);
        log.debug("[AiMetrics] {} SUCCESS latency={}ms", provider, latencyMs);
    }

    public void recordFailure(String provider) {
        ProviderStats s = getOrCreate(provider);
        s.totalCalls.incrementAndGet();
        s.failureCount.incrementAndGet();
        s.consecutiveFailures.incrementAndGet();
        log.warn("[AiMetrics] {} FAILURE consecutiveFails={}", provider, s.consecutiveFailures.get());
    }

    /**
     * Returns true when the provider is considered degraded:
     * ≥ 3 consecutive failures, OR average latency exceeds the supplied threshold.
     */
    public boolean isDegraded(String provider, long latencyThresholdMs) {
        ProviderStats s = stats.get(provider);
        if (s == null) return false;
        return s.consecutiveFailures.get() >= 3
            || (s.totalCalls.get() > 0 && avgLatency(provider) > latencyThresholdMs);
    }

    public int consecutiveFailures(String provider) {
        ProviderStats s = stats.get(provider);
        return s == null ? 0 : s.consecutiveFailures.get();
    }

    public long avgLatency(String provider) {
        ProviderStats s = stats.get(provider);
        if (s == null || s.successCount.get() == 0) return 0;
        return s.totalLatencyMs.get() / s.successCount.get();
    }

    /**
     * B3-G6: Returns a snapshot of all provider metrics for admin monitoring.
     * Exposed via GET /admin/ai-provider/metrics in AdminController.
     */
    public Map<String, ProviderSnapshot> snapshot() {
        Map<String, ProviderSnapshot> out = new ConcurrentHashMap<>();
        stats.forEach((provider, s) -> out.put(provider, new ProviderSnapshot(
            provider,
            s.totalCalls.get(),
            s.successCount.get(),
            s.failureCount.get(),
            s.consecutiveFailures.get(),
            avgLatency(provider)
        )));
        return out;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private ProviderStats getOrCreate(String provider) {
        return stats.computeIfAbsent(provider, k -> new ProviderStats());
    }

    private static class ProviderStats {
        final AtomicInteger totalCalls          = new AtomicInteger(0);
        final AtomicInteger successCount        = new AtomicInteger(0);
        final AtomicInteger failureCount        = new AtomicInteger(0);
        final AtomicInteger consecutiveFailures = new AtomicInteger(0);
        final AtomicLong    totalLatencyMs      = new AtomicLong(0);
    }

    /** B3-G6: Immutable snapshot used by AdminController. */
    public record ProviderSnapshot(
        String provider,
        int    totalCalls,
        int    successCount,
        int    failureCount,
        int    consecutiveFailures,
        long   avgLatencyMs
    ) {}
}
