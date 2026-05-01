package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.FeatureFlag;
import com.careerops.model.User;
import com.careerops.repository.AuditLogRepository;
import com.careerops.repository.FeatureFlagRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Task 135 — AdminService.
 *
 * Provides:
 *  - platformStats()     — live aggregation of key platform metrics
 *  - getAllFlags()        — all feature flags sorted by key
 *  - toggleFlag(key, on) — enable/disable a feature flag by key
 *  - softDeleteUser(id)  — mark user as deleted (sets deleted_at)
 */
@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private final UserRepository        users;
    private final UserJobRepository     userJobs;
    private final AuditLogRepository    auditLogs;
    private final FeatureFlagRepository flags;

    public AdminService(UserRepository users,
                        UserJobRepository userJobs,
                        AuditLogRepository auditLogs,
                        FeatureFlagRepository flags) {
        this.users     = users;
        this.userJobs  = userJobs;
        this.auditLogs = auditLogs;
        this.flags     = flags;
    }

    // ── Platform stats ──────────────────────────────────────────────────────────

    /**
     * Returns a snapshot of live platform metrics:
     *   totalUsers, activeUsers (no deleted_at), jobsDeliveredToday,
     *   auditEventsToday, topAuditEventTypes (last 24 h, top 5),
     *   activeFeatureFlags count.
     */
    public Map<String, Object> platformStats() {
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);

        long totalUsers  = users.count();
        long activeUsers = users.countByDeletedAtIsNull();
        long jobsToday   = userJobs.countDeliveredSince(since);
        long auditToday  = auditLogs.countCreatedSince(since);
        long activeFlagsCount = flags.findAll().stream()
            .filter(f -> Boolean.TRUE.equals(f.getEnabled())).count();

        List<Map<String, Object>> topEvents = auditLogs.topEventTypesSince(since).stream()
            .limit(5)
            .map(row -> Map.<String, Object>of(
                "eventType", row[0],
                "count",     row[1]
            ))
            .collect(Collectors.toList());

        return Map.of(
            "totalUsers",         totalUsers,
            "activeUsers",        activeUsers,
            "jobsDeliveredToday", jobsToday,
            "auditEventsToday",   auditToday,
            "topAuditEvents",     topEvents,
            "activeFlagCount",    activeFlagsCount,
            "asOf",               Instant.now().toString()
        );
    }

    // ── Feature flags ─────────────────────────────────────────────────────────

    public List<FeatureFlag> getAllFlags() {
        return flags.findAllByOrderByFlagKeyAsc();
    }

    @Transactional
    public FeatureFlag toggleFlag(String flagKey, boolean enabled) {
        FeatureFlag flag = flags.findByFlagKey(flagKey)
            .orElseThrow(() -> ApiException.notFound("Feature flag not found: " + flagKey));
        flag.setEnabled(enabled);
        return flags.save(flag);
    }

    // ── User management ────────────────────────────────────────────────────────

    /**
     * Soft-deletes a user by setting deleted_at = now().
     * Does NOT delete any related data — data retention is handled separately.
     */
    @Transactional
    public void softDeleteUser(UUID userId) {
        User user = users.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User not found: " + userId));
        if (user.getDeletedAt() != null) {
            throw ApiException.conflict("User is already deleted");
        }
        user.setDeletedAt(Instant.now());
        users.save(user);
        log.warn("Admin soft-deleted userId={}", userId);
    }
}
