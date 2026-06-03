package com.careerops.controller;

import com.careerops.service.sources.SourceHealthRegistry;
import com.careerops.service.sources.SourceHealthRegistry.SourceHealth;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Operational endpoints for scraping source health.
 *
 * Final resolved paths (context-path = /api/v1):
 *   GET /api/v1/health/sources          — all sources, keyed by sourceName
 *   GET /api/v1/health/sources/{name}   — single source (case-sensitive, e.g. "Adzuna")
 *
 * Consistent with HealthCheckController which maps to /health (same prefix).
 *
 * Response fields per source:
 *   sourceName       — e.g. "Adzuna"
 *   totalCalls       — total fetch attempts since startup
 *   totalSuccesses   — fetches that returned without exception
 *   totalFailures    — fetches that threw an exception
 *   consecutiveFails — current run of consecutive failures (resets on any success)
 *   lastSuccessAt    — ISO-8601 timestamp of last successful fetch
 *   lastFailureAt    — ISO-8601 timestamp of last failed fetch
 *   lastError        — message from the most recent exception
 *   lastJobCount     — job count returned in the last successful fetch
 *   circuitState     — CLOSED | OPEN | HALF_OPEN
 */
@RestController
@RequestMapping("/health/sources")
public class SourceHealthController {

    private final SourceHealthRegistry healthRegistry;

    public SourceHealthController(SourceHealthRegistry healthRegistry) {
        this.healthRegistry = healthRegistry;
    }

    /** Returns health metrics for every registered source. */
    @GetMapping
    public ResponseEntity<Map<String, SourceHealth>> allSources() {
        return ResponseEntity.ok(healthRegistry.getAllHealth());
    }

    /**
     * Returns health metrics for a single source by name.
     * Returns 404 if the source has never been called (not yet in the registry).
     */
    @GetMapping("/{sourceName}")
    public ResponseEntity<SourceHealth> singleSource(@PathVariable String sourceName) {
        SourceHealth health = healthRegistry.getHealth(sourceName);
        if (health == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(health);
    }
}
