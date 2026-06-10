package com.careerops.service;

import com.careerops.exception.PlanLimitExceededException;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
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
    private BillingPeriodService billingPeriodService;
    @Mock
    private SaasLifecycleTelemetry lifecycleTelemetry;
    @Mock
    private com.careerops.repository.SubscriptionRepository subscriptionRepository;
    @Mock
    private com.careerops.config.SaasBillingProperties saasBillingProperties;
    @Mock
    private com.careerops.repository.OrgRepository orgRepository;
    @Mock
    private OrganizationPlanSyncService organizationPlanSyncService;
    @Mock
    private UserQuotaGrantService quotaGrantService;

    private PlanEnforcementService service;
    private final UUID userId = UUID.randomUUID();
    private final UUID orgId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new PlanEnforcementService(
                environment,
                saasBillingProperties,
                resolver,
                subscriptionRepository,
                orgRepository,
                usageCounter,
                billingPeriodService,
                lifecycleTelemetry,
                organizationPlanSyncService,
                quotaGrantService);
        lenient().when(saasBillingProperties.isEnforcementEnabled()).thenReturn(true);
        lenient().when(quotaGrantService.unlimitedAccess(any())).thenReturn(false);
        lenient().when(quotaGrantService.unlimitedSkills(any())).thenReturn(false);
        lenient().when(subscriptionRepository.findByOrganizationIdForUpdate(any()))
                .thenAnswer(invocation -> subscriptionForOrg(invocation.getArgument(0)));
        lenient().when(subscriptionRepository.findByOrganizationId(any()))
                .thenAnswer(invocation -> Optional.of(subscriptionForOrg(invocation.getArgument(0))));
        lenient().when(billingPeriodService.resolvePeriodStart(any()))
                .thenReturn(Instant.now().minus(10, ChronoUnit.DAYS));
    }

    private Subscription subscriptionForOrg(UUID organizationId) {
        Subscription subscription = new Subscription();
        subscription.setId(UUID.randomUUID());
        subscription.setOrganizationId(organizationId);
        subscription.setCreatedAt(Instant.now().minus(30, ChronoUnit.DAYS));
        return subscription;
    }

    @Test
    void enforcementPropertyFalseBypassesChecks() {
        when(saasBillingProperties.isEnforcementEnabled()).thenReturn(false);

        service.checkAiRunAllowed(userId, 9);

        verify(resolver, never()).resolveForUser(any());
    }

    @Test
    void enforcementPropertyTrueBlocksAiRunWhenLimitExceeded() {
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        when(usageCounter.aiSkillRunsSince(eq(orgId), any())).thenReturn(5L);

        assertThrows(PlanLimitExceededException.class, () -> service.checkAiRunAllowed(userId, 1));
    }

    @Test
    void prodProfileAllowsAiRunUnderLimit() {
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        when(usageCounter.aiSkillRunsSince(eq(orgId), any())).thenReturn(4L);

        assertDoesNotThrow(() -> service.checkAiRunAllowed(userId, 1));
    }

    @Test
    void runAllCostBlocksWhenInsufficientHeadroom() {
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        when(usageCounter.aiSkillRunsSince(eq(orgId), any())).thenReturn(0L);

        assertThrows(PlanLimitExceededException.class, () -> service.checkAiRunAllowed(userId, 9));
    }

    @Test
    void legacyTrialingStatusUsesFreePlanLimits() {
        when(resolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId,
                UUID.randomUUID(),
                SubscriptionPlan.FREE,
                SubscriptionStatus.TRIALING,
                Instant.now().minus(1, ChronoUnit.DAYS)));
        when(usageCounter.jobApplicationsThisMonth(orgId)).thenReturn(10L);

        assertThrows(PlanLimitExceededException.class, () -> service.checkApplicationAllowed(userId));
    }

    @Test
    void cancelledSubscriptionBlocksUsage() {
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
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.ENTERPRISE));

        assertDoesNotThrow(() -> service.checkAiRunAllowed(userId, 100));

        verify(usageCounter, never()).aiSkillRunsSince(any(), any());
    }

    @Test
    void quotaGrantSkipsAiLimitCheckWithoutEnterprisePlan() {
        when(quotaGrantService.unlimitedAccess(userId)).thenReturn(true);

        assertDoesNotThrow(() -> service.checkAiRunAllowed(userId, 100));

        verify(resolver, never()).resolveForUser(any());
        verify(usageCounter, never()).aiSkillRunsSince(any(), any());
    }

    @Test
    void quotaGrantSkipsCvUploadWhenAtCap() {
        when(quotaGrantService.unlimitedAccess(userId)).thenReturn(true);
        when(usageCounter.cvUploadsTotal(orgId)).thenReturn(100L);

        assertDoesNotThrow(() -> service.checkCvUploadAllowed(userId));

        verify(resolver, never()).resolveForUser(any());
        verify(usageCounter, never()).cvUploadsTotal(any());
    }

    @Test
    void quotaGrantSkipsApplicationLimit() {
        when(quotaGrantService.unlimitedAccess(userId)).thenReturn(true);

        assertDoesNotThrow(() -> service.checkApplicationAllowed(userId));

        verify(resolver, never()).resolveForUser(any());
        verify(usageCounter, never()).jobApplicationsThisMonth(any());
    }

    @Test
    void unlimitedAccessBypassesCancelledSubscription() {
        when(quotaGrantService.unlimitedAccess(userId)).thenReturn(true);

        assertDoesNotThrow(() -> service.checkCvUploadAllowed(userId));

        verify(resolver, never()).resolveForUser(any());
    }

    @Test
    void orgWideApplicationLimitUsesSharedCounter() {
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        when(usageCounter.jobApplicationsThisMonth(orgId)).thenReturn(10L);

        assertThrows(PlanLimitExceededException.class, () -> service.checkApplicationAllowed(userId));
    }

    @Test
    void blocksTeamMemberInviteWhenFreeSeatCapReached() {
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.FREE));
        Subscription locked = new Subscription();
        locked.setId(UUID.randomUUID());
        locked.setOrganizationId(orgId);
        when(subscriptionRepository.findByOrganizationIdForUpdate(orgId)).thenReturn(Optional.of(locked));
        when(usageCounter.teamMembers(orgId)).thenReturn(1);

        assertThrows(PlanLimitExceededException.class, () -> service.checkTeamMemberAllowed(userId));
    }

    @Test
    void allowsTeamMemberInviteWhenUnderCap() {
        when(resolver.resolveForUser(userId)).thenReturn(activeContext(SubscriptionPlan.PRO));
        Subscription locked = new Subscription();
        locked.setId(UUID.randomUUID());
        locked.setOrganizationId(orgId);
        when(subscriptionRepository.findByOrganizationIdForUpdate(orgId)).thenReturn(Optional.of(locked));
        when(usageCounter.teamMembers(orgId)).thenReturn(2);

        assertDoesNotThrow(() -> service.checkTeamMemberAllowed(userId, 1));
    }

    @Test
    void trialingStatusNoLongerGrantsProLimits() {
        when(resolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId,
                UUID.randomUUID(),
                SubscriptionPlan.FREE,
                SubscriptionStatus.TRIALING,
                Instant.now().plus(3, ChronoUnit.DAYS)));
        when(usageCounter.aiSkillRunsSince(eq(orgId), any())).thenReturn(5L);

        assertThrows(PlanLimitExceededException.class, () -> service.checkAiRunAllowed(userId, 1));
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
