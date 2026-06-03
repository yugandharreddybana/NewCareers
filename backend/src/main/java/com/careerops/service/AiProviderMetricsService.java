package com.careerops.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Batch 3 — AI Provider Metrics Service
 *
 * Tracks per-provider latency and failure counts in memory.
 * Used by AiProviderRouter to decide failover.
 *
 * Metrics are not persisted — they reset on restart, which is intentional.
 * Purpose: detect a degraded provider *in the current process* and route
 * around it quickly, not for long-term observability (use Grafana/Datadog
 * for that).
 *
 * Providers tracked: "nvidia", "claude", "gemini"
 */
@Service
@Slf4j
public class AiProviderMetricsService {

    // Sliding window size for average latency
    private static final int WINDOW = 20;

    // provider → rolling latency samples (circular buffer)
    private final Map<String, long[]> latencyWindows = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> latencyIndexes = new ConcurrentHashMap<>();

    // provider → total failure count
    private final Map<String, AtomicLong> failureCounts = new ConcurrentHashMap<>();

    // provider → consecutive failure count (resets on success)
    private final Map<String, AtomicLong> consecutiveFailures = new ConcurrentHashMap<>();

    // ── Record a successful call ───────────────────────────────────────────────

    /**
     * Record a successful LLM call and its latency in milliseconds.
     */
    public void recordSuccess(String provider, long latencyMs) {
        long[] window = latencyWindows.computeIfAbsent(provider, k -> new long[WINDOW]);
        AtomicLong idx = latencyIndexes.computeIfAbsent(provider, k -> new AtomicLong(0));
        window[(int)(idx.getAndIncrement() % WINDOW)] = latencyMs;
        // Reset consecutive failure counter on success
        consecutiveFailures.computeIfAbsent(provider, k -> new AtomicLong(0)).set(0);
        log.debug("[AiMetrics] {} success latency={}ms avgLatency={}ms",
                provider, latencyMs, avgLatency(provider));
    }

    // ── Record a failure ───────────────────────────────────────────────────────

    /**
     * Record a failed LLM call (timeout, 5xx, exception).
     */
    public void recordFailure(String provider) {
        failureCounts.computeIfAbsent(provider, k -> new AtomicLong(0)).incrementAndGet();
        consecutiveFailures.computeIfAbsent(provider, k -> new AtomicLong(0)).incrementAndGet();
        log.warn("[AiMetrics] {} failure totalFailures={} consecutiveFailures={}",
                provider,
                failureCounts.get(provider).get(),
                consecutiveFailures.get(provider).get());
    }

    // ── Query methods ──────────────────────────────────────────────────────────

    /**
     * Average latency in ms over the last WINDOW calls. Returns 0 if no data.
     */
    public long avgLatency(String provider) {
        long[] window = latencyWindows.get(provider);
        if (window == null) return 0;
        long sum = 0, count = 0;
        for (long v : window) { if (v > 0) { sum += v; count++; } }
        return count == 0 ? 0 : sum / count;
    }

    /**
     * Total failure count since last restart.
     */
    public long totalFailures(String provider) {
        AtomicLong c = failureCounts.get(provider);
        return c == null ? 0 : c.get();
    }

    /**
     * Number of consecutive failures without a success in between.
     */
    public long consecutiveFailures(String provider) {
        AtomicLong c = consecutiveFailures.get(provider);
        return c == null ? 0 : c.get();
    }

    /**
     * Returns true if the provider is considered degraded:
     *  - 3 or more consecutive failures, OR
     *  - average latency exceeds the threshold (ms)
     */
    public boolean isDegraded(String provider, long latencyThresholdMs) {
        return consecutiveFailures(provider) >= 3
                || (avgLatency(provider) > latencyThresholdMs && avgLatency(provider) > 0);
    }

    /**
     * Reset all metrics for a provider (e.g. after manual recovery).
     */
    public void reset(String provider) {
        latencyWindows.remove(provider);
        latencyIndexes.remove(provider);
        failureCounts.remove(provider);
        consecutiveFailures.remove(provider);
        log.info("[AiMetrics] Reset metrics for provider={}", provider);
    }

    /**
     * Snapshot of all provider metrics — for an admin/health endpoint.
     */
    public Map<String, ProviderSnapshot> snapshot() {
        Map<String, ProviderSnapshot> out = new ConcurrentHashMap<>();
        for (String p : failureCounts.keySet()) {
            out.put(p, new ProviderSnapshot(p, avgLatency(p), totalFailures(p), consecutiveFailures(p)));
        }
        return out;
    }

    public record ProviderSnapshot(
            String provider,
            long avgLatencyMs,
            long totalFailures,
            long consecutiveFailures) {}
}
