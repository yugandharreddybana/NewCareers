package com.careerops.service;

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
    public void log(UUID userId, String action, HttpServletRequest request, Map<String, Object> metadata) {
        try {
            String ip        = resolveIp(request);
            String userAgent = request != null ? request.getHeader("User-Agent") : null;

            Map<String, Object> meta = metadata != null ? new HashMap<>(metadata) : new HashMap<>();

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

    /** Convenience overload — no HttpServletRequest (e.g. scheduled/cron contexts). */
    public void log(UUID userId, String action, Map<String, Object> metadata) {
        log(userId, action, null, metadata);
    }

    /** Convenience overload — no metadata. */
    public void log(UUID userId, String action, HttpServletRequest request) {
        log(userId, action, request, null);
    }

    private String resolveIp(HttpServletRequest request) {
        if (request == null) return null;
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
