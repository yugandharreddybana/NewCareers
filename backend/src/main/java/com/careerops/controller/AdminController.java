package com.careerops.controller;

import com.careerops.exception.ApiException;
import com.careerops.model.FeatureFlag;
import com.careerops.service.AdminService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Task 136 — Internal admin REST API.
 *
 * ALL endpoints in this controller are protected by an explicit
 * X-Internal-Secret header check — they must never be exposed to end users.
 *
 * Endpoints:
 *   GET    /admin/stats              — live platform statistics
 *   GET    /admin/flags              — all feature flags
 *   PUT    /admin/flags/{key}        — toggle a feature flag
 *   DELETE /admin/users/{userId}     — soft-delete a user
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final AdminService admin;

    @Value("${internal.trust.secret}")
    private String trustSecret;

    public AdminController(AdminService admin) {
        this.admin = admin;
    }

    // ── Guard ────────────────────────────────────────────────────────────────

    private void requireAdminSecret(String provided) {
        if (!trustSecret.equals(provided)) {
            throw ApiException.forbidden("Admin access denied");
        }
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    /**
     * GET /admin/stats
     * Returns live platform metrics: total/active users, jobs delivered today,
     * audit events today, top 5 audit event types, active flag count.
     */
    @GetMapping("/stats")
    public Map<String, Object> stats(
            @RequestHeader("X-Internal-Secret") String secret) {
        requireAdminSecret(secret);
        return admin.platformStats();
    }

    // ── Feature flags ────────────────────────────────────────────────────────

    /**
     * GET /admin/flags
     * Returns all feature flags sorted alphabetically by key.
     */
    @GetMapping("/flags")
    public List<FeatureFlag> flags(
            @RequestHeader("X-Internal-Secret") String secret) {
        requireAdminSecret(secret);
        return admin.getAllFlags();
    }

    /**
     * PUT /admin/flags/{key}
     * Body: { "enabled": true | false }
     * Toggles the named feature flag. Returns the updated flag.
     */
    @PutMapping("/flags/{key}")
    public FeatureFlag toggleFlag(
            @RequestHeader("X-Internal-Secret") String secret,
            @PathVariable String key,
            @RequestBody Map<String, Boolean> body) {
        requireAdminSecret(secret);
        Boolean enabled = body.get("enabled");
        if (enabled == null) throw ApiException.badRequest("Body must contain \"enabled\" field");
        return admin.toggleFlag(key, enabled);
    }

    // ── User management ────────────────────────────────────────────────────────

    /**
     * DELETE /admin/users/{userId}
     * Soft-deletes the specified user (sets deleted_at). Returns 204 on success.
     */
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteUser(
            @RequestHeader("X-Internal-Secret") String secret,
            @PathVariable UUID userId) {
        requireAdminSecret(secret);
        admin.softDeleteUser(userId);
        return ResponseEntity.noContent().build();
    }
}
