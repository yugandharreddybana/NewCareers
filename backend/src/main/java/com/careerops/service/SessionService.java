package com.careerops.service;

import com.careerops.dto.SecurityDtos.*;
import com.careerops.model.UserSession;
import com.careerops.repository.UserSessionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class SessionService {

    private final UserSessionRepository repo;

    public SessionService(UserSessionRepository repo) {
        this.repo = repo;
    }

    public UserSession createSession(UUID userId, String deviceInfo, String ipAddress, String userAgent) {
        String token = generateToken();
        UserSession session = UserSession.builder()
            .userId(userId)
            .sessionToken(token)
            .deviceInfo(deviceInfo)
            .ipAddress(ipAddress)
            .userAgent(userAgent)
            .expiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
            .build();
        return repo.save(session);
    }

    public List<SessionResponse> listSessions(UUID userId, String currentToken) {
        return repo.findByUserIdAndRevokedFalseOrderByCreatedAtDesc(userId).stream()
            .map(s -> toResponse(s, s.getSessionToken().equals(currentToken)))
            .toList();
    }

    public void revokeSession(UUID userId, UUID sessionId) {
        UserSession s = repo.findById(sessionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        if (!s.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your session");
        }
        s.setRevoked(true);
        s.setRevokedAt(Instant.now());
        repo.save(s);
    }

    public int revokeAllSessions(UUID userId) {
        return repo.revokeAllByUserId(userId, Instant.now());
    }

    private SessionResponse toResponse(UserSession s, boolean current) {
        return new SessionResponse(s.getId(), s.getDeviceInfo(), s.getIpAddress(),
            s.getUserAgent(), s.getLastActiveAt(), s.getExpiresAt(), current, s.getCreatedAt());
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
