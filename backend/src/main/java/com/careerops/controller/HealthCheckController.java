package com.careerops.controller;

import com.careerops.service.JobScrapeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Quick operational health endpoint.
 * GET /api/v1/health/status
 *
 * Returns:
 *  - overall status (UP / DEGRADED / DOWN)
 *  - database ping result
 *  - number of enabled job sources
 *  - server timestamp
 */
@RestController
@RequestMapping("/health")
public class HealthCheckController {

    private final DataSource dataSource;
    private final JobScrapeService jobScrapeService;

    public HealthCheckController(DataSource dataSource, JobScrapeService jobScrapeService) {
        this.dataSource = dataSource;
        this.jobScrapeService = jobScrapeService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timestamp", Instant.now().toString());

        // DB check
        boolean dbUp = false;
        try (Connection conn = dataSource.getConnection()) {
            dbUp = conn.isValid(3);
        } catch (Exception e) {
            result.put("db_error", e.getMessage());
        }
        result.put("database", dbUp ? "UP" : "DOWN");
        result.put("job_sources", jobScrapeService.getEnabledSourceNames().size());
        result.put("sources", jobScrapeService.getEnabledSourceNames());
        result.put("status", dbUp ? "UP" : "DEGRADED");

        return ResponseEntity.ok(result);
    }
}
