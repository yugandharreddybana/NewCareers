package com.careerops.controller;

import com.careerops.exception.ApiException;
import com.careerops.model.FeatureFlag;
import com.careerops.service.AdminService;
import com.careerops.service.AuditLogService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.Arrays;
import jakarta.annotation.PostConstruct;

/**
 * Task 136 — Internal admin REST API.
 *
 * ALL endpoints in this controller are protected by an explicit
 * X-Internal-Secret header check — they must never be exposed to end users.
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/admin")
@io.micrometer.core.annotation.Timed
public class AdminController {

    private final AdminService admin;
    private final AuditLogService auditLogService;

    @Value("${internal.trust.secret}")
    private String trustSecret;

    @Value("${app.admin.user-ids:}")
    private String adminUserIdsRaw;

    private Set<UUID> adminUserIds;

    public AdminController(AdminService admin, AuditLogService auditLogService) {
        this.admin = admin;
        this.auditLogService = auditLogService;
    }

    @PostConstruct
    public void validateConfig() {
        if (trustSecret == null || trustSecret.length() < 32 || trustSecret.equals("CHANGE_ME_LONG_RANDOM_STRING")) {
            throw new IllegalStateException("FATAL: internal.trust.secret is too short or uses default value. Admin APIs are insecure.");
        }
        if (adminUserIdsRaw != null && !adminUserIdsRaw.isBlank()) {
            adminUserIds = Arrays.stream(adminUserIdsRaw.split(","))
                .map(String::trim)
                .map(UUID::fromString)
                .collect(Collectors.toSet());
        } else {
            adminUserIds = Set.of();
            // log.warn("No admin user IDs configured. Admin APIs will rely solely on secret header.");
        }
    }

    // ── Guard ────────────────────────────────────────────────────────────────

    private void requireAdmin(String providedSecret, UUID userId) {
        // 1. Secret check (Internal Trust)
        if (providedSecret == null || trustSecret == null ||
            !MessageDigest.isEqual(
                trustSecret.getBytes(StandardCharsets.UTF_8),
                providedSecret.getBytes(StandardCharsets.UTF_8)
            )) {
            throw ApiException.forbidden("Admin access denied: Invalid secret");
        }

        // 2. Role/User check (Defense in depth)
        // If adminUserIds is empty, we only rely on the secret (for backward compatibility if not set)
        // but if it IS set, we enforce it.
        if (!adminUserIds.isEmpty() && (userId == null || !adminUserIds.contains(userId))) {
            throw ApiException.forbidden("Admin access denied: User not authorized");
        }
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    /**
     * GET /admin/stats
     * Returns live platform metrics: total/active users, jobs delivered today,
     * audit events today, top 5 audit event types, active flag count.
     */
    @GetMapping("/stats")
    public com.careerops.dto.AdminDtos.AdminStatsResponse stats(
            @RequestHeader("X-Internal-Secret") String secret) {
        UUID userId = com.careerops.util.AuthUtil.currentUserId();
        requireAdmin(secret, userId);
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
        UUID userId = com.careerops.util.AuthUtil.currentUserId();
        requireAdmin(secret, userId);
        return admin.getAllFlags();
    }

    public record ToggleFlagRequest(
        @jakarta.validation.constraints.NotNull(message = "enabled is required") Boolean enabled
    ) {}

    /**
     * PUT /admin/flags/{key}
     * Body: { "enabled": true | false }
     * Toggles the named feature flag. Returns the updated flag.
     */
    @PutMapping("/flags/{key}")
    public FeatureFlag toggleFlag(
            @RequestHeader("X-Internal-Secret") String secret,
            @PathVariable String key,
            @jakarta.validation.Valid @RequestBody ToggleFlagRequest req) {
        UUID userId = com.careerops.util.AuthUtil.currentUserId();
        requireAdmin(secret, userId);
        if (key == null || !key.matches("^[a-z0-9_-]{1,64}$")) {
            throw ApiException.badRequest("Invalid key format");
        }
        Boolean enabled = req.enabled();
        FeatureFlag updated = admin.toggleFlag(key, enabled);
        auditLogService.log(userId, "TOGGLE_FLAG", Map.of("key", key, "enabled", enabled));
        return updated;
    }

    /**
     * GET /admin/users
     * Returns a paginated list of all users on the platform.
     */
    @GetMapping("/users")
    public com.careerops.dto.AdminDtos.UserListResponse listUsers(
            @RequestHeader("X-Internal-Secret") String secret,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        UUID currentAdminId = com.careerops.util.AuthUtil.currentUserId();
        requireAdmin(secret, currentAdminId);
        return admin.listUsers(page, size);
    }

    // ── User management ────────────────────────────────────────────────────────

    /**
     * DELETE /admin/users/{userId}
     * Soft-deletes the specified user (sets deleted_at). Returns 204 on success.
     */
    @DeleteMapping("/users/{userId}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void deleteUser(
            @RequestHeader("X-Internal-Secret") String secret,
            @PathVariable UUID userId) {
        UUID currentAdminId = com.careerops.util.AuthUtil.currentUserId();
        requireAdmin(secret, currentAdminId);
        admin.softDeleteUser(userId);
        auditLogService.log(currentAdminId, "SOFT_DELETE_USER", Map.of("targetUserId", userId));
    }
}
