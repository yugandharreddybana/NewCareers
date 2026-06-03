package com.careerops.controller;

import com.careerops.service.AdminService;
import com.careerops.service.AiProviderMetricsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin Controller
 *
 * B3-G6 FIX: Added GET /admin/ai-provider/metrics endpoint.
 * Previously AiProviderMetricsService computed detailed provider health
 * data but it was completely inaccessible — there was no endpoint that
 * called snapshot(). This endpoint exposes that data to admins.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Admin-only operations")
public class AdminController {

    private final AdminService             adminService;
    private final AiProviderMetricsService aiMetrics;

    /**
     * B3-G6: Returns a live snapshot of all AI provider metrics.
     * Includes: totalCalls, successCount, failureCount,
     *           consecutiveFailures, avgLatencyMs per provider.
     * Secured to ROLE_ADMIN only.
     */
    @GetMapping("/ai-provider/metrics")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "AI provider health metrics",
               description = "Live snapshot of Gemini/Claude call outcomes and latency. Admin only.")
    public ResponseEntity<Map<String, AiProviderMetricsService.ProviderSnapshot>> getAiProviderMetrics() {
        return ResponseEntity.ok(aiMetrics.snapshot());
    }
}
