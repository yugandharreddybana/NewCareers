package com.careerops.service;

import com.careerops.repository.ApplicationTaskRepository;
import com.careerops.repository.AuditLogRepository;
import com.careerops.repository.DailyFetchLogRepository;
import com.careerops.repository.PasswordResetRepository;
import com.careerops.repository.ReferralOutboxRepository;
import com.careerops.repository.RefreshTokenRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserConsentRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CronJobServiceGdprRetentionTest {

    @Mock JobDeliveryService delivery;
    @Mock UserProfileRepository profiles;
    @Mock JobDigestService digest;
    @Mock DeduplicationService dedup;
    @Mock DailyFetchLogRepository fetchLogs;
    @Mock WeeklyDigestService weeklyDigest;
    @Mock UserRepository users;
    @Mock ApplicationTaskRepository taskRepo;
    @Mock EmailService email;
    @Mock ReferralService referralService;
    @Mock ReferralOutboxRepository referralOutbox;
    @Mock SkillRunRepository skillRuns;
    @Mock MeterRegistry meterRegistry;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock AuditLogRepository auditLogs;
    @Mock PasswordResetRepository passwordResets;
    @Mock UserConsentRepository userConsents;
    @Mock AuditLogService audit;

    private CronJobService cronJobService;

    @BeforeEach
    void setUp() {
        cronJobService = new CronJobService(
                delivery, profiles, digest, dedup, fetchLogs, weeklyDigest,
                users, taskRepo, email, referralService, referralOutbox,
                skillRuns, meterRegistry, refreshTokens,
                auditLogs, passwordResets, userConsents, audit);
    }

    @Test
    void runGdprRetentionCleanup_deletesWithCorrectCutoffsAndAuditsCounts() {
        when(auditLogs.deleteByCreatedAtBefore(any())).thenReturn(10);
        when(passwordResets.deleteByCreatedAtBefore(any())).thenReturn(3);
        when(refreshTokens.deleteByExpiresAtBefore(any())).thenReturn(7);
        when(userConsents.deleteForUsersDeletedBefore(any())).thenReturn(2);

        Instant before = Instant.now();
        cronJobService.runGdprRetentionCleanup();
        Instant after = Instant.now();

        ArgumentCaptor<Instant> auditCutoff = ArgumentCaptor.forClass(Instant.class);
        verify(auditLogs).deleteByCreatedAtBefore(auditCutoff.capture());
        assertThat(auditCutoff.getValue())
                .isBetween(before.minus(366, ChronoUnit.DAYS), after.minus(364, ChronoUnit.DAYS));

        ArgumentCaptor<Instant> passwordCutoff = ArgumentCaptor.forClass(Instant.class);
        verify(passwordResets).deleteByCreatedAtBefore(passwordCutoff.capture());
        assertThat(passwordCutoff.getValue())
                .isBetween(before.minus(31, ChronoUnit.DAYS), after.minus(29, ChronoUnit.DAYS));

        ArgumentCaptor<Instant> refreshCutoff = ArgumentCaptor.forClass(Instant.class);
        verify(refreshTokens).deleteByExpiresAtBefore(refreshCutoff.capture());
        assertThat(refreshCutoff.getValue()).isBetween(before, after);

        ArgumentCaptor<Instant> consentCutoff = ArgumentCaptor.forClass(Instant.class);
        verify(userConsents).deleteForUsersDeletedBefore(consentCutoff.capture());
        assertThat(consentCutoff.getValue())
                .isBetween(before.minus(31, ChronoUnit.DAYS), after.minus(29, ChronoUnit.DAYS));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> metadataCaptor = ArgumentCaptor.forClass(Map.class);
        verify(audit).log(isNull(), eq("GDPR_RETENTION_CLEANUP"), isNull(), metadataCaptor.capture());
        Map<String, Object> metadata = metadataCaptor.getValue();
        assertThat(metadata)
                .containsEntry("auditLogsDeleted", 10)
                .containsEntry("passwordResetsDeleted", 3)
                .containsEntry("refreshTokensDeleted", 7)
                .containsEntry("userConsentsDeleted", 2);
    }
}
