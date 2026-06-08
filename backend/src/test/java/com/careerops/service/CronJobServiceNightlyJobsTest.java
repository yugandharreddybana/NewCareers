package com.careerops.service;

import com.careerops.model.UserProfile;
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
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CronJobServiceNightlyJobsTest {

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
    @Mock RefreshTokenRepository refreshTokens;
    @Mock AuditLogRepository auditLogs;
    @Mock PasswordResetRepository passwordResets;
    @Mock UserConsentRepository userConsents;
    @Mock AuditLogService audit;

    private SimpleMeterRegistry meterRegistry;
    private CronJobService cronJobService;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        cronJobService = new CronJobService(
                delivery, profiles, digest, dedup, fetchLogs, weeklyDigest,
                users, taskRepo, email, referralService, referralOutbox,
                skillRuns, meterRegistry, refreshTokens,
                auditLogs, passwordResets, userConsents, audit);
    }

    @Test
    void nightlyJobFetch_callsFetchAndStoreOnlyPerOnboardedUser() {
        UUID userId = UUID.randomUUID();
        UserProfile profile = new UserProfile();
        profile.setUserId(userId);
        when(profiles.findAllByOnboardedTrue()).thenReturn(List.of(profile));

        cronJobService.nightlyJobFetch();

        verify(delivery).fetchAndStoreOnly(userId);
        verify(delivery, never()).deliver(org.mockito.ArgumentMatchers.any(), anyInt());
    }

    @Test
    void nightlyJobScore_callsScoreStoredJobsWithBatchSize() {
        UUID userId = UUID.randomUUID();
        UserProfile profile = new UserProfile();
        profile.setUserId(userId);
        when(profiles.findAllByOnboardedTrue()).thenReturn(List.of(profile));
        when(delivery.batchSize()).thenReturn(12);

        cronJobService.nightlyJobScore();

        verify(delivery).scoreStoredJobs(userId, 12);
    }

    @Test
    void nightlyJobScore_incrementsFailureMetricWhenScoringThrows() {
        UUID userId = UUID.randomUUID();
        UserProfile profile = new UserProfile();
        profile.setUserId(userId);
        when(profiles.findAllByOnboardedTrue()).thenReturn(List.of(profile));
        when(delivery.batchSize()).thenReturn(10);
        doThrow(new RuntimeException("boom")).when(delivery).scoreStoredJobs(userId, 10);

        cronJobService.nightlyJobScore();

        assertThat(meterRegistry.counter("cron.job.failed", "job", "nightlyJobScore").count())
            .isEqualTo(1.0);
    }
}
