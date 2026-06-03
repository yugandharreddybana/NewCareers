package com.careerops.service.sources;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Lightweight per-source sliding-window circuit breaker.
 *
 * States:
 *   CLOSED     — normal operation, calls pass through.
 *   OPEN       — circuit tripped; calls are blocked immediately (returns empty).
 *   HALF_OPEN  — probe mode; one call is allowed through to test recovery.
 *
 * Transitions:
 *   CLOSED  → OPEN      : consecutiveFailures >= failureThreshold
 *   OPEN    → HALF_OPEN  : openDurationMs elapsed since trip time
 *   HALF_OPEN → CLOSED   : successThreshold successes in HALF_OPEN
 *   HALF_OPEN → OPEN     : any failure in HALF_OPEN
 *
 * Thread safety: AtomicInteger for counters, volatile for state/timestamps.
 */
public class ScraperCircuitBreaker {

    private static final Logger log = LoggerFactory.getLogger(ScraperCircuitBreaker.class);

    public enum State { CLOSED, OPEN, HALF_OPEN }

    private final String sourceName;
    private final int    failureThreshold;   // consecutive failures before OPEN
    private final long   openDurationMs;     // how long to stay OPEN before probing
    private final int    successThreshold;   // successes in HALF_OPEN before CLOSED

    private volatile State         state               = State.CLOSED;
    private volatile Instant       openedAt            = null;
    private final    AtomicInteger consecutiveFailures = new AtomicInteger(0);
    private final    AtomicInteger halfOpenSuccesses   = new AtomicInteger(0);

    public ScraperCircuitBreaker(String sourceName, int failureThreshold,
                                  long openDurationMs, int successThreshold) {
        this.sourceName       = sourceName;
        this.failureThreshold = failureThreshold;
        this.openDurationMs   = openDurationMs;
        this.successThreshold = successThreshold;
    }

    /** Returns true if the call should be allowed through. */
    public synchronized boolean allowCall() {
        switch (state) {
            case CLOSED:
                return true;
            case OPEN:
                if (openedAt != null &&
                        Instant.now().toEpochMilli() - openedAt.toEpochMilli() >= openDurationMs) {
                    transitionTo(State.HALF_OPEN);
                    return true; // allow one probe
                }
                log.debug("[{}] Circuit OPEN — blocking call", sourceName);
                return false;
            case HALF_OPEN:
                return true; // probe is in flight
            default:
                return true;
        }
    }

    /** Call this after a successful source fetch. */
    public synchronized void recordSuccess() {
        consecutiveFailures.set(0);
        if (state == State.HALF_OPEN) {
            if (halfOpenSuccesses.incrementAndGet() >= successThreshold) {
                transitionTo(State.CLOSED);
            }
        }
    }

    /** Call this after a failed/empty source fetch. */
    public synchronized void recordFailure() {
        if (state == State.HALF_OPEN) {
            transitionTo(State.OPEN);
            return;
        }
        if (consecutiveFailures.incrementAndGet() >= failureThreshold) {
            transitionTo(State.OPEN);
        }
    }

    public State getState() { return state; }

    public int getConsecutiveFailures() { return consecutiveFailures.get(); }

    private void transitionTo(State next) {
        log.info("[{}] Circuit breaker: {} → {}", sourceName, state, next);
        state = next;
        if (next == State.OPEN) {
            openedAt = Instant.now();
            halfOpenSuccesses.set(0);
        } else if (next == State.CLOSED) {
            openedAt = null;
            halfOpenSuccesses.set(0);
            consecutiveFailures.set(0);
        } else if (next == State.HALF_OPEN) {
            halfOpenSuccesses.set(0);
        }
    }
}
