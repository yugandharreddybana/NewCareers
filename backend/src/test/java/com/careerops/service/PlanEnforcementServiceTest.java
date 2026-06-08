package com.careerops.service;

import com.careerops.exception.PlanLimitExceededException;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlanEnforcementServiceTest {

    @Mock
    private Environment environment;
    @Mock
    private OrganizationSubscriptionResolver resolver;
    @Mock
    private OrgUsageCounter usageCounter;
    @Mock
    private SaasLifecycleTelemetry lifecycleTelemetry;

    private PlanEnforcementService service;
    private final UUID userId = UUID.randomUUID();
    private final UUID orgId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new PlanEnforcementService(environment, resolver, usageCounter, lifecycleTelemetry);
    }

    @Test
    void devProfileBypassesChecks() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(true);

        service.checkAiRunAllowed(userId, 9);

        verify(resolver, never()).resolveForUser(any());
    }

    @Test
    void prodProfileBlocksAiRunWhenLimitExceeded() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(false);
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        when(usageCounter.aiSkillRunsThisMonth(orgId)).thenReturn(5L);

        assertThrows(PlanLimitExceededException.class, () -> service.checkAiRunAllowed(userId, 1));
    }

    @Test
    void prodProfileAllowsAiRunUnderLimit() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(false);
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        when(usageCounter.aiSkillRunsThisMonth(orgId)).thenReturn(4L);

        assertDoesNotThrow(() -> service.checkAiRunAllowed(userId, 1));
    }

    @Test
    void runAllCostBlocksWhenInsufficientHeadroom() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(false);
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        when(usageCounter.aiSkillRunsThisMonth(orgId)).thenReturn(0L);

        assertThrows(PlanLimitExceededException.class, () -> service.checkAiRunAllowed(userId, 9));
    }

    @Test
    void expiredTrialBlocksUsage() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(false);
        when(resolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId,
                UUID.randomUUID(),
                SubscriptionPlan.FREE,
                SubscriptionStatus.TRIALING,
                Instant.now().minus(1, ChronoUnit.DAYS)));

        assertThrows(PlanLimitExceededException.class, () -> service.checkApplicationAllowed(userId));
    }

    @Test
    void cancelledSubscriptionBlocksUsage() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(false);
        when(resolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId,
                UUID.randomUUID(),
                SubscriptionPlan.PRO,
                SubscriptionStatus.CANCELLED,
                null));

        assertThrows(PlanLimitExceededException.class, () -> service.checkCvUploadAllowed(userId));
    }

    @Test
    void enterprisePlanSkipsAiLimitCheck() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(false);
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.ENTERPRISE));

        assertDoesNotThrow(() -> service.checkAiRunAllowed(userId, 100));

        verify(usageCounter, never()).aiSkillRunsThisMonth(any());
    }

    @Test
    void orgWideApplicationLimitUsesSharedCounter() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(false);
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        when(usageCounter.jobApplicationsThisMonth(orgId)).thenReturn(10L);

        assertThrows(PlanLimitExceededException.class, () -> service.checkApplicationAllowed(userId));
    }

    @Test
    void trialingUserGetsProLimits() {
        when(environment.acceptsProfiles(Profiles.of("dev", "test"))).thenReturn(false);
        when(resolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId,
                UUID.randomUUID(),
                SubscriptionPlan.FREE,
                SubscriptionStatus.TRIALING,
                Instant.now().plus(3, ChronoUnit.DAYS)));
        when(usageCounter.aiSkillRunsThisMonth(orgId)).thenReturn(50L);

        assertDoesNotThrow(() -> service.checkAiRunAllowed(userId, 100));
    }

    private SubscriptionContext activeContext(SubscriptionPlan plan) {
        return new SubscriptionContext(
                orgId,
                UUID.randomUUID(),
                plan,
                SubscriptionStatus.ACTIVE,
                null);
    }
}
