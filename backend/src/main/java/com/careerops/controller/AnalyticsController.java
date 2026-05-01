package com.careerops.controller;

import com.careerops.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Analytics REST endpoints.
 *
 * GET /analytics/summary          — weekly stats + skill usage
 * GET /analytics/funnel           — application pipeline counts per kanban stage
 * GET /analytics/time-series      — weekly trend data for charts (new)
 */
@RestController
@RequestMapping("/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestHeader("X-User-Id") String userId) {
        try {
            return ResponseEntity.ok(analyticsService.getWeeklyStats(UUID.fromString(userId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/funnel")
    public ResponseEntity<List<Map<String, Object>>> getFunnel(
            @RequestHeader("X-User-Id") String userId) {
        try {
            return ResponseEntity.ok(analyticsService.getApplicationFunnel(UUID.fromString(userId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * GET /analytics/time-series?weeks=8
     *
     * Returns weekly application + match-average trend for the last N weeks.
     * Response: [ { week: "2026-04-28", applications: 3, matchAvg: 72 }, ... ]
     *
     * @param weeks number of rolling weeks (1-52, default 8)
     */
    @GetMapping("/time-series")
    public ResponseEntity<List<Map<String, Object>>> getTimeSeries(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(defaultValue = "8") int weeks) {
        try {
            return ResponseEntity.ok(
                analyticsService.getWeeklyTimeSeries(UUID.fromString(userId), weeks)
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
