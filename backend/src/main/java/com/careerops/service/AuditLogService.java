package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.model.AuditLog;
import com.careerops.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Task 115 — Audit log service.
 * Called on every login, every skill run, every data export, and account deletion.
 * Never throws — logging failure must never block the primary action.
 */
@Service
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final AuditLogRepository repo;

    public AuditLogService(AuditLogRepository repo) {
        this.repo = repo;
    }

    /**
     * Log an action performed by a user.
     *
     * @param userId   the acting user's UUID (may be null for anonymous/system events)
     * @param action   short action label, e.g. "LOGIN", "SKILL_RUN", "DATA_EXPORT", "ACCOUNT_DELETE"
     * @param request  the inbound HttpServletRequest (used to extract IP + user-agent); may be null
     * @param metadata any additional key-value pairs to persist as JSONB
     */
    public void log(@Nullable UUID userId, String action, @Nullable HttpServletRequest request, @Nullable Map<String, Object> metadata) {
        try {
            String ip        = resolveIp(request);
            String userAgent = request != null ? request.getHeader("User-Agent") : null;

            Map<String, Object> meta = metadata != null ? new HashMap<>(metadata) : new HashMap<>();
            
            // 3.035 — Mask sensitive keys before persisting to DB
            maskSecrets(meta);

            AuditLog entry = AuditLog.builder()
                .userId(userId)
                .action(action)
                .ipAddress(ip)
                .userAgent(userAgent)
                .metadata(meta)
                .build();

            repo.save(entry);
        } catch (Exception e) {
            log.warn("AuditLogService non-fatal error for action={} userId={}: {}", action, userId, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void maskSecrets(Map<String, Object> meta) {
        if (meta == null) return;
        java.util.List<String> toMask = java.util.List.of("api_key", "token", "secret", "password", "apikey", "auth", "otp", "key");
        for (String key : new java.util.HashSet<>(meta.keySet())) {
            Object val = meta.get(key);
            if (val instanceof Map) {
                maskSecrets((Map<String, Object>) val);
            } else if (val instanceof String) {
                String kL = key.toLowerCase();
                if (toMask.stream().anyMatch(kL::contains)) {
                    meta.put(key, "[MASKED]");
                }
            }
        }
    }

    /** Convenience overload — no HttpServletRequest (e.g. scheduled/cron contexts). */
    public void log(@Nullable UUID userId, String action, @Nullable Map<String, Object> metadata) {
        log(userId, action, null, metadata);
    }

    /** Convenience overload — no metadata. */
    public void log(@Nullable UUID userId, String action, @Nullable HttpServletRequest request) {
        log(userId, action, request, null);
    }

    private @Nullable String resolveIp(@Nullable HttpServletRequest request) {
        if (request == null) return null;
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
