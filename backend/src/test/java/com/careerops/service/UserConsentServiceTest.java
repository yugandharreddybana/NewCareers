package com.careerops.service;

import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.UserConsent;
import com.careerops.model.UserConsent.ConsentType;
import com.careerops.repository.UserConsentRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserConsentServiceTest {

    @Mock UserConsentRepository repo;
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
