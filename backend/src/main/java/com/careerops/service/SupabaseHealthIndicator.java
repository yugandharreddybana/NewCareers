package com.careerops.service;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * 3.086 — Actuator Health Indicator for Supabase.
 * Verifies that the storage layer is reachable and authorized.
 */
@Component
public class SupabaseHealthIndicator implements HealthIndicator {

    private final SupabaseStorageService supabase;

    public SupabaseHealthIndicator(SupabaseStorageService supabase) {
        this.supabase = supabase;
    }

    @Override
    public Health health() {
        try {
            supabase.ping();
            return Health.up()
                .withDetail("storage", "reachable")
                .build();
        } catch (Exception e) {
            return Health.down()
                .withDetail("error", e.getMessage())
                .build();
        }
    }
}
