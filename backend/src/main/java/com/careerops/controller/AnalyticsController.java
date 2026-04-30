package com.careerops.controller;

import com.careerops.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section 5 — Task 47
 *
 * Analytics REST endpoints.
 * All routes require a valid JWT — the middleware injects X-User-Id header.
 *
 * GET /analytics/summary  — weekly stats + skill usage
 * GET /analytics/funnel   — application pipeline counts per kanban stage
 */
@RestController
@RequestMapping("/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    /**
     * GET /analytics/summary
     * Returns:
     *   skillsRunThisWeek    — int
     *   applicationsSubmitted — int
     *   avgMatchPercent      — int (0-100)
     *   skillUsage           — [ { skill, count } ]
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestHeader("X-User-Id") String userId) {
        try {
            Map<String, Object> summary = analyticsService.getWeeklyStats(UUID.fromString(userId));
            return ResponseEntity.ok(summary);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * GET /analytics/funnel
     * Returns ordered list:
     *   [ { stage: "Discovered", count: 45 }, { stage: "Saved", count: 20 }, ... ]
     * All 6 stages always present (zero-filled if empty).
     */
    @GetMapping("/funnel")
    public ResponseEntity<List<Map<String, Object>>> getFunnel(
            @RequestHeader("X-User-Id") String userId) {
        try {
            List<Map<String, Object>> funnel =
                analyticsService.getApplicationFunnel(UUID.fromString(userId));
            return ResponseEntity.ok(funnel);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
