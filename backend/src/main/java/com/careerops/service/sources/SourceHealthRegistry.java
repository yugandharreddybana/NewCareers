package com.careerops.service.sources;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Tracks per-source health metrics across the lifetime of the application.
 *
 * Metrics per source:
 *   - totalCalls        : total number of fetch attempts
 *   - totalSuccesses    : successful fetches (>= 1 job returned)
 *   - totalFailures     : failed or empty fetches
 *   - consecutiveFails  : current run of consecutive failures (resets on success)
 *   - lastSuccessAt     : timestamp of most recent successful fetch
 *   - lastFailureAt     : timestamp of most recent failure
 *   - lastError         : message from the most recent exception
 *   - lastJobCount      : number of jobs returned in the last successful fetch
 */
@Component
public class SourceHealthRegistry {

    public static class SourceHealth {
        public final String  sourceName;
        public final long    totalCalls;
        public final long    totalSuccesses;
        public final long    totalFailures;
        public final long    consecutiveFails;
        public final Instant lastSuccessAt;
        public final Instant lastFailureAt;
        public final String  lastError;
        public final int     lastJobCount;
        public final String  circuitState;

        public SourceHealth(String sourceName, long totalCalls, long totalSuccesses,
                            long totalFailures, long consecutiveFails,
                            Instant lastSuccessAt, Instant lastFailureAt,
                            String lastError, int lastJobCount, String circuitState) {
            this.sourceName      = sourceName;
            this.totalCalls      = totalCalls;
            this.totalSuccesses  = totalSuccesses;
            this.totalFailures   = totalFailures;
            this.consecutiveFails = consecutiveFails;
            this.lastSuccessAt   = lastSuccessAt;
            this.lastFailureAt   = lastFailureAt;
            this.lastError       = lastError;
            this.lastJobCount    = lastJobCount;
            this.circuitState    = circuitState;
        }
    }

    private static class SourceStats {
        AtomicLong totalCalls       = new AtomicLong();
        AtomicLong totalSuccesses   = new AtomicLong();
        AtomicLong totalFailures    = new AtomicLong();
        AtomicLong consecutiveFails = new AtomicLong();
        volatile Instant lastSuccessAt;
        volatile Instant lastFailureAt;
        volatile String  lastError;
        volatile int     lastJobCount;
        volatile String  circuitState = "CLOSED";
    }

    private final ConcurrentHashMap<String, SourceStats> registry = new ConcurrentHashMap<>();

    private SourceStats stats(String source) {
        return registry.computeIfAbsent(source, k -> new SourceStats());
    }

    public void recordSuccess(String source, int jobCount) {
        SourceStats s = stats(source);
        s.totalCalls.incrementAndGet();
        s.totalSuccesses.incrementAndGet();
        s.consecutiveFails.set(0);
        s.lastSuccessAt = Instant.now();
        s.lastJobCount  = jobCount;
    }

    public void recordFailure(String source, String errorMessage) {
        SourceStats s = stats(source);
        s.totalCalls.incrementAndGet();
        s.totalFailures.incrementAndGet();
        s.consecutiveFails.incrementAndGet();
        s.lastFailureAt = Instant.now();
        s.lastError     = errorMessage;
    }

    public void updateCircuitState(String source, String state) {
        stats(source).circuitState = state;
    }

    public Map<String, SourceHealth> getAllHealth() {
        Map<String, SourceHealth> result = new HashMap<>();
        registry.forEach((name, s) -> result.put(name, new SourceHealth(
                name,
                s.totalCalls.get(),
                s.totalSuccesses.get(),
                s.totalFailures.get(),
                s.consecutiveFails.get(),
                s.lastSuccessAt,
                s.lastFailureAt,
                s.lastError,
                s.lastJobCount,
                s.circuitState
        )));
        return result;
    }

    public SourceHealth getHealth(String source) {
        SourceStats s = registry.get(source);
        if (s == null) return null;
        return new SourceHealth(
                source, s.totalCalls.get(), s.totalSuccesses.get(),
                s.totalFailures.get(), s.consecutiveFails.get(),
                s.lastSuccessAt, s.lastFailureAt, s.lastError,
                s.lastJobCount, s.circuitState
        );
    }
}
