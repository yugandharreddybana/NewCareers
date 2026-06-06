package com.careerops.service;

import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import com.careerops.exception.ApiException;
import com.careerops.dto.ConsentDtos.WithdrawAiConsentResult;
import com.careerops.model.User;
import com.careerops.model.UserConsent;
import com.careerops.model.UserConsent.ConsentType;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserConsentRepository;
import com.careerops.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserConsentServiceTest {

    @Mock UserConsentRepository repo;
    @Mock UserRepository users;
    @Mock SkillRunRepository skillRuns;
    @Mock AuditLogService audit;
    @Mock HttpServletRequest request;

    @InjectMocks UserConsentService service;

    private final UUID userId = UUID.randomUUID();

    @Test
    @DisplayName("recordConsent persists explicit accepted=true")
    void recordConsentAcceptedTrue() {
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.1");
        when(request.getHeader("User-Agent")).thenReturn("TestAgent/1.0");
        when(repo.save(any(UserConsent.class))).thenAnswer(inv -> inv.getArgument(0));

        UserConsent saved = service.recordConsent(userId, ConsentType.MARKETING, "v2.0", true, request);

        assertThat(saved.isAccepted()).isTrue();
        assertThat(saved.getConsentType()).isEqualTo(ConsentType.MARKETING);
        verify(audit).log(eq(userId), eq("CONSENT_RECORDED"), eq(request),
                eq(Map.of("type", "MARKETING", "accepted", true, "version", "v2.0")));
    }

    @Test
    @DisplayName("validateAiConsent throws when AI_PROCESSING not granted")
    void validateAiConsentThrowsWhenDenied() {
        when(repo.findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(userId, ConsentType.AI_PROCESSING))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.validateAiConsent(userId))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("validateAiConsent passes when AI_PROCESSING accepted")
    void validateAiConsentPasses() {
        when(repo.findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(userId, ConsentType.AI_PROCESSING))
                .thenReturn(Optional.of(UserConsent.builder().accepted(true).build()));

        service.validateAiConsent(userId);
    }

    @Test
    @DisplayName("updateConsent rejects ESSENTIAL")
    void updateConsentRejectsEssential() {
        assertThatThrownBy(() -> service.updateConsent(
                userId, ConsentType.ESSENTIAL, "v1.0", true, request))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("updateConsent allows AI_PROCESSING withdrawal")
    void updateConsentAiProcessing() {
        when(repo.save(any(UserConsent.class))).thenAnswer(inv -> inv.getArgument(0));

        UserConsent saved = service.updateConsent(
                userId, ConsentType.AI_PROCESSING, "v1.0", false, request);

        assertThat(saved.isAccepted()).isFalse();
        assertThat(saved.getConsentType()).isEqualTo(ConsentType.AI_PROCESSING);
    }

    @Test
    @DisplayName("withdrawAiConsent records withdrawal, syncs legacy column, purges old skill runs")
    void withdrawAiConsent() {
        User user = User.builder().id(userId).aiProcessingConsent(true).build();
        when(repo.findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(userId, ConsentType.AI_PROCESSING))
                .thenReturn(Optional.of(UserConsent.builder().accepted(true).build()));
        when(repo.save(any(UserConsent.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(skillRuns.deleteByUserIdAndCreatedAtBefore(eq(userId), any())).thenReturn(2);

        WithdrawAiConsentResult result = service.withdrawAiConsent(userId, request);

        assertThat(result.consent().isAccepted()).isFalse();
        assertThat(result.skillRunsDeleted()).isEqualTo(2);
        assertThat(user.isAiProcessingConsent()).isFalse();

        ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(skillRuns).deleteByUserIdAndCreatedAtBefore(eq(userId), cutoffCaptor.capture());
        assertThat(cutoffCaptor.getValue())
                .isBefore(Instant.now().minus(UserConsentService.SKILL_RUN_RETENTION_DAYS_ON_WITHDRAWAL - 1, ChronoUnit.DAYS));

        verify(audit).log(eq(userId), eq("AI_CONSENT_WITHDRAWN"), eq(request),
                eq(Map.of("version", "v1.0", "skillRunsDeleted", 2)));
    }

    @Test
    @DisplayName("withdrawAiConsent idempotent when AI already withdrawn")
    void withdrawAiConsentIdempotent() {
        when(repo.findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(userId, ConsentType.AI_PROCESSING))
                .thenReturn(Optional.of(UserConsent.builder()
                        .id(UUID.randomUUID())
                        .userId(userId)
                        .consentType(ConsentType.AI_PROCESSING)
                        .version("v1.0")
                        .accepted(false)
                        .acceptedAt(Instant.parse("2026-06-01T00:00:00Z"))
                        .build()));
        when(skillRuns.deleteByUserIdAndCreatedAtBefore(eq(userId), any())).thenReturn(0);

        WithdrawAiConsentResult result = service.withdrawAiConsent(userId, request);

        assertThat(result.consent().isAccepted()).isFalse();
        assertThat(result.skillRunsDeleted()).isZero();
        verify(repo, never()).save(any());
        verify(users, never()).findById(any());
        verify(audit, never()).log(eq(userId), eq("AI_CONSENT_WITHDRAWN"), any(), any());
    }

    @Test
    @DisplayName("recordSignupConsents records all four types")
    void recordSignupConsents() {
        when(repo.save(any(UserConsent.class))).thenAnswer(inv -> inv.getArgument(0));
        SignupConsentsRequest consents = new SignupConsentsRequest(true, true, false, true);

        service.recordSignupConsents(userId, consents, request);

        ArgumentCaptor<UserConsent> cap = ArgumentCaptor.forClass(UserConsent.class);
        verify(repo, org.mockito.Mockito.times(4)).save(cap.capture());
        assertThat(cap.getAllValues()).extracting(UserConsent::getConsentType)
                .containsExactly(
                        ConsentType.ESSENTIAL,
                        ConsentType.AI_PROCESSING,
                        ConsentType.MARKETING,
                        ConsentType.ANALYTICS);
    }
}
