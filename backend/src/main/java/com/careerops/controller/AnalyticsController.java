package com.careerops.controller;

import com.careerops.service.AnalyticsService;
import com.careerops.util.AuthUtil;
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
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/analytics")
@io.micrometer.core.annotation.Timed
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    public Map<String, Object> getSummary() {
        UUID userId = AuthUtil.currentUserId();
        return analyticsService.getWeeklyStats(userId);
    }

    @GetMapping("/funnel")
    public List<Map<String, Object>> getFunnel(@RequestParam(required = false) Integer days) {
        UUID userId = AuthUtil.currentUserId();
        java.time.Instant since = null;
        if (days != null) {
            since = java.time.Instant.now().minus(days, java.time.temporal.ChronoUnit.DAYS);
        }
        return analyticsService.getApplicationFunnel(userId, since);
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
    public List<Map<String, Object>> getTimeSeries(
            @RequestParam(defaultValue = "8") int weeks) {
        UUID userId = AuthUtil.currentUserId();
        return analyticsService.getWeeklyTimeSeries(userId, weeks);
    }
}
