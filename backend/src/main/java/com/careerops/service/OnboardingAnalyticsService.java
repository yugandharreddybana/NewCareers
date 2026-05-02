package com.careerops.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Section 3.6 Tasks 69+70 — records onboarding completion events and feature
 * adoption events. Uses JdbcTemplate for lightweight inserts to avoid heavy
 * entity overhead on high-frequency analytics paths.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingAnalyticsService {

    private final JdbcTemplate jdbc;

    // Task 69 — onboarding drop-off tracking
    public void trackOnboardingStep(UUID userId, String step, String eventType, Map<String, Object> metadata) {
        try {
            jdbc.update(
                "INSERT INTO onboarding_events (user_id, step, event_type, metadata) VALUES (?, ?, ?, ?::jsonb)",
                userId, step, eventType, toJson(metadata)
            );
        } catch (Exception e) {
            log.warn("[OnboardingAnalytics] Failed to track step={} for user={}: {}", step, userId, e.getMessage());
        }
    }

    // Task 70 — feature adoption tracking
    public void trackFeatureAdoption(UUID userId, String feature, String action, Map<String, Object> metadata) {
        try {
            jdbc.update(
                "INSERT INTO feature_adoption_events (user_id, feature, action, metadata) VALUES (?, ?, ?, ?::jsonb)",
                userId, feature, action, toJson(metadata)
            );
        } catch (Exception e) {
            log.warn("[FeatureAdoption] Failed to track feature={} for user={}: {}", feature, userId, e.getMessage());
        }
    }

    private String toJson(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) return "{}";
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(metadata);
        } catch (Exception e) {
            return "{}";
        }
    }
}
