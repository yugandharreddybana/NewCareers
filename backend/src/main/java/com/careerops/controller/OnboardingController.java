package com.careerops.controller;

import com.careerops.service.OnboardingAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingAnalyticsService analyticsService;
    private final JdbcTemplate jdbc;

    // Task 74 — GET /onboarding/checklist
    // Returns the list of onboarding step keys the user has completed
    @GetMapping("/checklist")
    public ResponseEntity<Map<String, Object>> getChecklist(
            @AuthenticationPrincipal UUID userId) {

        List<String> completedSteps = jdbc.queryForList(
            "SELECT step FROM onboarding_events WHERE user_id = ? AND event_type = 'completed'",
            String.class, userId
        );

        return ResponseEntity.ok(Map.of(
            "completedSteps", completedSteps
        ));
    }

    // Tasks 69+70 — POST /onboarding/event
    @PostMapping("/event")
    public ResponseEntity<Void> trackEvent(
            @AuthenticationPrincipal UUID userId,
            @RequestBody Map<String, Object> body) {

        String type = (String) body.getOrDefault("type", "onboarding"); // 'onboarding' | 'feature'
        String step = (String) body.get("step");
        String event = (String) body.getOrDefault("eventType", "completed");

        if (step == null) return ResponseEntity.badRequest().build();

        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = (Map<String, Object>) body.getOrDefault("metadata", Map.of());

        if ("feature".equals(type)) {
            String feature = (String) body.getOrDefault("feature", step);
            String action  = (String) body.getOrDefault("action",  event);
            analyticsService.trackFeatureAdoption(userId, feature, action, metadata);
        } else {
            analyticsService.trackOnboardingStep(userId, step, event, metadata);
        }

        return ResponseEntity.noContent().build();
    }
}
