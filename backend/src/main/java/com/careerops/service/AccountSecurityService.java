package com.careerops.service;

import com.careerops.dto.SecurityDtos.AuditLogEntry;
import com.careerops.dto.SecurityDtos.AuditLogResponse;
import com.careerops.dto.SecurityDtos.SecurityActivityEntry;
import com.careerops.dto.SecurityDtos.SecurityActivityResponse;
import com.careerops.dto.SecurityDtos.SessionResponse;
import com.careerops.exception.ApiException;
import com.careerops.model.AuditLog;
import com.careerops.model.RefreshToken;
import com.careerops.repository.AuditLogRepository;
import com.careerops.repository.RefreshTokenRepository;
import com.careerops.util.UserAgentParser;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountSecurityService {

    private static final Set<String> SECURITY_ACTIONS = Set.of(
            "LOGIN", "LOGOUT", "TOKEN_REFRESH", "GOOGLE_LOGIN", "GOOGLE_SIGNUP",
            "ACCOUNT_LOCKED", "PASSWORD_CHANGED", "PASSWORD_RESET",
            "TWO_FACTOR_ENABLED", "TWO_FACTOR_DISABLED",
            "SESSION_REVOKED", "SESSIONS_REVOKED_OTHERS"
    );

    private final RefreshTokenRepository refreshTokens;
    private final AuditLogRepository auditLogs;
    private final AuditLogService audit;

    @Transactional(readOnly = true)
    public List<SessionResponse> listSessions(UUID userId, @Nullable String currentRefreshRaw) {
        String currentHash = hashRefresh(currentRefreshRaw);
        Instant now = Instant.now();

        return refreshTokens.findByUserIdOrderByLastUsedAtDesc(userId).stream()
                .filter(rt -> rt.getConsumedAt() == null)
                .filter(rt -> rt.getExpiresAt() == null || rt.getExpiresAt().isAfter(now))
                .map(rt -> toSession(rt, currentHash))
                .toList();
    }

    @Transactional
    public void revokeSession(UUID userId, UUID sessionId, @Nullable String currentRefreshRaw,
                              HttpServletRequest request) {
        RefreshToken rt = refreshTokens.findById(sessionId)
                .orElseThrow(() -> ApiException.notFound("Session not found"));
        if (!rt.getUserId().equals(userId)) {
            throw ApiException.notFound("Session not found");
        }
        String currentHash = hashRefresh(currentRefreshRaw);
        if (currentHash != null && currentHash.equals(rt.getTokenHash())) {
            throw ApiException.badRequest("Cannot revoke the current session from this device");
        }
        refreshTokens.delete(rt);
        audit.log(userId, "SESSION_REVOKED", request, java.util.Map.of("sessionId", sessionId.toString()));
    }

    @Transactional
    public int revokeOtherSessions(UUID userId, @Nullable String currentRefreshRaw, HttpServletRequest request) {
        String currentHash = hashRefresh(currentRefreshRaw);
        List<RefreshToken> all = refreshTokens.findByUserIdOrderByLastUsedAtDesc(userId);
        int removed = 0;
        for (RefreshToken rt : all) {
            if (currentHash != null && currentHash.equals(rt.getTokenHash())) {
                continue;
            }
            refreshTokens.delete(rt);
            removed++;
        }
        if (removed > 0) {
            audit.log(userId, "SESSIONS_REVOKED_OTHERS", request, java.util.Map.of("count", removed));
        }
        return removed;
    }

    @Transactional(readOnly = true)
    public SecurityActivityResponse listSecurityActivity(UUID userId, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        int safePage = Math.max(page, 0);
        Page<AuditLog> result = auditLogs.findByUserIdAndActionInOrderByCreatedAtDesc(
                userId, SECURITY_ACTIONS, PageRequest.of(safePage, safeSize));

        List<SecurityActivityEntry> entries = result.getContent().stream()
                .map(this::toActivityEntry)
                .toList();

        return new SecurityActivityResponse(entries, (int) result.getTotalElements(), safePage, safeSize);
    }

    @Transactional(readOnly = true)
    public AuditLogResponse listAuditLog(UUID userId, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        Page<AuditLog> result = auditLogs.findByUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(safePage, safeSize));
        List<AuditLogEntry> entries = result.getContent().stream()
                .map(a -> new AuditLogEntry(
                        a.getId(),
                        a.getAction(),
                        a.getResourceType(),
                        a.getResourceId(),
                        a.getIpAddress(),
                        a.getSeverity(),
                        a.getCreatedAt()))
                .toList();
        return new AuditLogResponse(entries, (int) result.getTotalElements());
    }

    private SessionResponse toSession(RefreshToken rt, @Nullable String currentHash) {
        String ua = rt.getDeviceInfo();
        boolean current = currentHash != null && currentHash.equals(rt.getTokenHash());
        Instant lastActive = rt.getLastUsedAt() != null ? rt.getLastUsedAt() : rt.getCreatedAt();
        return new SessionResponse(
                rt.getId(),
                UserAgentParser.friendlyLabel(ua),
                rt.getIpAddress(),
                ua,
                lastActive,
                rt.getExpiresAt(),
                current,
                rt.getCreatedAt());
    }

    private SecurityActivityEntry toActivityEntry(AuditLog log) {
        String ua = log.getUserAgent();
        String subtitle = UserAgentParser.friendlyLabel(ua);
        if (subtitle.equals("Unknown device") && log.getIpAddress() != null) {
            subtitle = "IP: " + log.getIpAddress();
        }
        return new SecurityActivityEntry(
                log.getId(),
                friendlyActionTitle(log.getAction()),
                friendlyActionSubtitle(log.getAction(), subtitle),
                log.getAction(),
                log.getCreatedAt());
    }

    static String friendlyActionTitle(String action) {
        return switch (action) {
            case "LOGIN" -> "Successful login";
            case "LOGOUT" -> "Signed out";
            case "TOKEN_REFRESH" -> "Session refreshed";
            case "GOOGLE_LOGIN" -> "Google sign-in";
            case "GOOGLE_SIGNUP" -> "Google sign-up";
            case "ACCOUNT_LOCKED" -> "Account temporarily locked";
            case "PASSWORD_CHANGED" -> "Password changed";
            case "PASSWORD_RESET" -> "Password reset";
            case "TWO_FACTOR_ENABLED" -> "Two-factor authentication enabled";
            case "TWO_FACTOR_DISABLED" -> "Two-factor authentication disabled";
            case "SESSION_REVOKED" -> "Session ended";
            case "SESSIONS_REVOKED_OTHERS" -> "Other sessions ended";
            default -> action.replace('_', ' ').toLowerCase();
        };
    }

    private static String friendlyActionSubtitle(String action, String deviceLabel) {
        if ("PASSWORD_CHANGED".equals(action) || "PASSWORD_RESET".equals(action)) {
            return "Via Web Application";
        }
        if ("ACCOUNT_LOCKED".equals(action)) {
            return "Too many failed attempts";
        }
        return deviceLabel;
    }

    @Nullable
    static String hashRefresh(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
