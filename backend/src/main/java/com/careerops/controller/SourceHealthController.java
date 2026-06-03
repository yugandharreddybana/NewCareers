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
 * GET /api/v1/health/sources          — all sources
 * GET /api/v1/health/sources/{name}   — specific source (e.g. "Adzuna")
 *
 * Response fields per source:
 *   sourceName, totalCalls, totalSuccesses, totalFailures,
 *   consecutiveFails, lastSuccessAt, lastFailureAt, lastError,
 *   lastJobCount, circuitState (CLOSED/OPEN/HALF_OPEN)
 */
@RestController
@RequestMapping("/health/sources")
public class SourceHealthController {

    private final SourceHealthRegistry healthRegistry;

    public SourceHealthController(SourceHealthRegistry healthRegistry) {
        this.healthRegistry = healthRegistry;
    }

    @GetMapping
    public ResponseEntity<Map<String, SourceHealth>> allSources() {
        return ResponseEntity.ok(healthRegistry.getAllHealth());
    }

    @GetMapping("/{sourceName}")
    public ResponseEntity<SourceHealth> singleSource(@PathVariable String sourceName) {
        SourceHealth health = healthRegistry.getHealth(sourceName);
        if (health == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(health);
    }
}
