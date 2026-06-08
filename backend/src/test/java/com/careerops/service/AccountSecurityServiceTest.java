package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.RefreshToken;
import com.careerops.repository.AuditLogRepository;
import com.careerops.repository.RefreshTokenRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountSecurityServiceTest {

    @Mock RefreshTokenRepository refreshTokens;
    @Mock AuditLogRepository auditLogs;
    @Mock AuditLogService audit;
    @Mock HttpServletRequest request;

    @InjectMocks AccountSecurityService service;

    UUID userId = UUID.randomUUID();

    @Test
    @DisplayName("hashRefresh is stable and null-safe")
    void hashRefresh() {
        assertThat(AccountSecurityService.hashRefresh(null)).isNull();
        assertThat(AccountSecurityService.hashRefresh("  ")).isNull();
        String a = AccountSecurityService.hashRefresh("refresh-token-abc");
        String b = AccountSecurityService.hashRefresh("refresh-token-abc");
        assertThat(a).isNotBlank().isEqualTo(b);
    }

    @Test
    @DisplayName("friendlyActionTitle maps security events")
    void friendlyActionTitle() {
        assertThat(AccountSecurityService.friendlyActionTitle("PASSWORD_CHANGED"))
                .isEqualTo("Password changed");
        assertThat(AccountSecurityService.friendlyActionTitle("SESSIONS_REVOKED_OTHERS"))
                .isEqualTo("Other sessions ended");
    }

    @Test
    @DisplayName("revokeOtherSessions keeps current refresh token")
    void revokeOtherSessionsKeepsCurrent() {
        String currentRaw = "current-refresh";
        String currentHash = AccountSecurityService.hashRefresh(currentRaw);
        UUID currentId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();

        RefreshToken current = RefreshToken.builder()
                .id(currentId)
                .userId(userId)
                .tokenHash(currentHash)
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        RefreshToken other = RefreshToken.builder()
                .id(otherId)
                .userId(userId)
                .tokenHash("other-hash")
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        when(refreshTokens.findByUserIdOrderByLastUsedAtDesc(userId))
                .thenReturn(List.of(current, other));

        int removed = service.revokeOtherSessions(userId, currentRaw, request);

        assertThat(removed).isEqualTo(1);
        verify(refreshTokens).delete(other);
        verify(refreshTokens, never()).delete(current);
        verify(audit).log(any(), any(), any(), any());
    }

    @Test
    @DisplayName("revokeSession blocks current session")
    void revokeSessionBlocksCurrent() {
        String currentRaw = "device-refresh";
        String currentHash = AccountSecurityService.hashRefresh(currentRaw);
        UUID sessionId = UUID.randomUUID();
        RefreshToken current = RefreshToken.builder()
                .id(sessionId)
                .userId(userId)
                .tokenHash(currentHash)
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        when(refreshTokens.findById(sessionId)).thenReturn(Optional.of(current));

        assertThatThrownBy(() -> service.revokeSession(userId, sessionId, currentRaw, request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("current session");
    }
}
