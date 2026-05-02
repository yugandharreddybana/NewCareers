package com.careerops.controller;

import com.careerops.service.ExperimentAssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Section 3.6 Tasks 76+77+79 — experiment variant resolution endpoints.
 * Admin config-flag management is handled via the admin console (Phase 5).
 */
@RestController
@RequestMapping("/api/experiments")
@RequiredArgsConstructor
public class ExperimentController {

    private final ExperimentAssignmentService experimentService;

    // GET /experiments/variants — returns all active experiment variants for the user
    // Used by frontend ExperimentContext to load assignments on app boot
    @GetMapping("/variants")
    public ResponseEntity<Map<String, String>> getVariants(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(experimentService.getAllVariants(userId));
    }

    // GET /experiments/variant/{key} — single variant lookup
    @GetMapping("/variant/{key}")
    public ResponseEntity<Map<String, String>> getVariant(
            @AuthenticationPrincipal UUID userId,
            @PathVariable String key) {
        String variant = experimentService.getVariant(userId, key);
        return ResponseEntity.ok(Map.of("key", key, "variant", variant));
    }
}
