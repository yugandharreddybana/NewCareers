package com.careerops.controller;

import com.careerops.service.ExperimentAssignmentService;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Section 3.6 Tasks 76+77+79 — experiment variant resolution endpoints.
 * Admin config-flag management is handled via the admin console (Phase 5).
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/experiments")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class ExperimentController {

    private final ExperimentAssignmentService experimentService;

    // GET /experiments/variants — returns all active experiment variants for the user
    // Used by frontend ExperimentContext to load assignments on app boot
    @GetMapping("/variants")
    public Map<String, String> getVariants() {
        UUID userId = AuthUtil.currentUserId();
        return experimentService.getAllVariants(userId);
    }

    // GET /experiments/variant/{key} — single variant lookup
    @GetMapping("/variant/{key}")
    public Map<String, String> getVariant(
            @PathVariable String key) {
        UUID userId = AuthUtil.currentUserId();
        String variant = experimentService.getVariant(userId, key);
        return Map.of("key", key, "variant", variant);
    }
}
