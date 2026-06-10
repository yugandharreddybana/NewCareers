package com.careerops.service;

import com.careerops.model.PlanTier;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.repository.SubscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageLimitServiceTest {

    @Mock DailyLimitService dailyLimitService;
    @Mock TokenUsageService tokenUsageService;
    @Mock UserPlanTierService planTierService;
    @Mock OrganizationSubscriptionResolver subscriptionResolver;
    @Mock SubscriptionRepository subscriptionRepository;
    @Mock OrgUsageCounter orgUsageCounter;
    @Mock BillingPeriodService billingPeriodService;
    @Mock UserQuotaGrantService quotaGrantService;

    private UsageLimitService usageLimitService;

    private final UUID userId = UUID.randomUUID();
    private final UUID orgId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        usageLimitService = new UsageLimitService(
                dailyLimitService,
                tokenUsageService,
                planTierService,
                subscriptionResolver,
                subscriptionRepository,
                orgUsageCounter,
                billingPeriodService,
                quotaGrantService);
    }

    @Test
    void snapshot_combinesJobAiAndSkillQuotas() {
        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.PREMIUM);
        when(dailyLimitService.getCount(userId)).thenReturn(3);
        when(dailyLimitService.maxForUser(userId)).thenReturn(25);
        when(dailyLimitService.remaining(userId)).thenReturn(22);
        when(tokenUsageService.tokensUsedSinceStartOfQuotaDay(userId)).thenReturn(120_000L);
        when(quotaGrantService.tokenBudget(userId, PlanTier.PREMIUM)).thenReturn(500_000L);
        when(quotaGrantService.unlimitedSkills(userId)).thenReturn(false);
        when(quotaGrantService.unlimitedAccess(userId)).thenReturn(false);

        Subscription subscription = new Subscription();
        subscription.setOrganizationId(orgId);
        subscription.setCreatedAt(Instant.now().minus(5, ChronoUnit.DAYS));
        Instant periodStart = Instant.now().minus(5, ChronoUnit.DAYS);
        Instant periodEnd = Instant.now().plus(25, ChronoUnit.DAYS);

        when(subscriptionResolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId, UUID.randomUUID(), SubscriptionPlan.PRO, SubscriptionStatus.ACTIVE, null));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(billingPeriodService.resolvePeriodStart(subscription)).thenReturn(periodStart);
        when(billingPeriodService.nextResetInstant(subscription)).thenReturn(periodEnd);
        when(orgUsageCounter.aiSkillRunsSince(eq(orgId), eq(periodStart))).thenReturn(12L);

        var response = usageLimitService.snapshot(userId);

        assertThat(response.jobDelivery().label()).isEqualTo("Jobs Left");
        assertThat(response.jobDelivery().used()).isEqualTo(3);
        assertThat(response.jobDelivery().limit()).isEqualTo(25);
        assertThat(response.jobDelivery().remaining()).isEqualTo(22);
        assertThat(response.aiTokens().label()).isEqualTo("AI Tokens");
        assertThat(response.aiTokens().used()).isEqualTo(120_000);
        assertThat(response.aiTokens().limit()).isEqualTo(500_000);
        assertThat(response.aiTokens().remaining()).isEqualTo(380_000);
        assertThat(response.skillRuns().label()).isEqualTo("Skills Left");
        assertThat(response.skillRuns().used()).isEqualTo(12);
        assertThat(response.skillRuns().limit()).isEqualTo(200);
        assertThat(response.skillRuns().remaining()).isEqualTo(188);
        assertThat(response.skillRuns().periodStart()).isEqualTo(periodStart.toString());
        assertThat(response.skillRuns().resetsAt()).isEqualTo(periodEnd.toString());
        assertThat(response.planName()).isEqualTo("PRO");
        assertThat(response.timezoneId()).isEqualTo("Europe/Dublin");
    }

    @Test
    void snapshot_exposesUnlimitedSkillsForQuotaGrant() {
        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.FREE);
        when(dailyLimitService.getCount(userId)).thenReturn(0);
        when(dailyLimitService.maxForUser(userId)).thenReturn(25);
        when(dailyLimitService.remaining(userId)).thenReturn(25);
        when(tokenUsageService.tokensUsedSinceStartOfQuotaDay(userId)).thenReturn(0L);
        when(quotaGrantService.tokenBudget(userId, PlanTier.FREE)).thenReturn(500_000L);
        when(quotaGrantService.unlimitedSkills(userId)).thenReturn(true);
        when(quotaGrantService.unlimitedAccess(userId)).thenReturn(false);

        Subscription subscription = new Subscription();
        subscription.setOrganizationId(orgId);
        when(subscriptionResolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId, UUID.randomUUID(), SubscriptionPlan.FREE, SubscriptionStatus.ACTIVE, null));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(billingPeriodService.resolvePeriodStart(any())).thenReturn(Instant.now().minus(1, ChronoUnit.DAYS));
        when(billingPeriodService.nextResetInstant(any())).thenReturn(Instant.now().plus(29, ChronoUnit.DAYS));
        when(orgUsageCounter.aiSkillRunsSince(eq(orgId), any())).thenReturn(500L);

        var response = usageLimitService.snapshot(userId);

        assertThat(response.skillRuns().limit()).isEqualTo(-1);
        assertThat(response.skillRuns().remaining()).isEqualTo(-1);
        assertThat(response.aiTokens().limit()).isEqualTo(500_000);
        assertThat(response.planName()).isEqualTo("FREE");
    }

    @Test
    void snapshot_exposesUnlimitedSkillsForEnterprise() {
        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.PREMIUM);
        when(dailyLimitService.getCount(userId)).thenReturn(0);
        when(dailyLimitService.maxForUser(userId)).thenReturn(25);
        when(dailyLimitService.remaining(userId)).thenReturn(25);
        when(tokenUsageService.tokensUsedSinceStartOfQuotaDay(userId)).thenReturn(0L);
        when(quotaGrantService.tokenBudget(userId, PlanTier.PREMIUM)).thenReturn(500_000L);
        when(quotaGrantService.unlimitedSkills(userId)).thenReturn(false);
        when(quotaGrantService.unlimitedAccess(userId)).thenReturn(false);

        Subscription subscription = new Subscription();
        subscription.setOrganizationId(orgId);
        when(subscriptionResolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId, UUID.randomUUID(), SubscriptionPlan.ENTERPRISE, SubscriptionStatus.ACTIVE, null));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(billingPeriodService.resolvePeriodStart(any())).thenReturn(Instant.now().minus(1, ChronoUnit.DAYS));
        when(billingPeriodService.nextResetInstant(any())).thenReturn(Instant.now().plus(29, ChronoUnit.DAYS));
        when(orgUsageCounter.aiSkillRunsSince(eq(orgId), any())).thenReturn(500L);

        var response = usageLimitService.snapshot(userId);

        assertThat(response.skillRuns().limit()).isEqualTo(-1);
        assertThat(response.skillRuns().remaining()).isEqualTo(-1);
        assertThat(response.planName()).isEqualTo("ENTERPRISE");
    }

    @Test
    void snapshot_exposesUnlimitedQuotasForUnlimitedAccessGrant() {
        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.FREE);
        when(dailyLimitService.getCount(userId)).thenReturn(10);
        when(tokenUsageService.tokensUsedSinceStartOfQuotaDay(userId)).thenReturn(999_999L);
        when(quotaGrantService.unlimitedAccess(userId)).thenReturn(true);

        Subscription subscription = new Subscription();
        subscription.setOrganizationId(orgId);
        when(subscriptionResolver.resolveForUser(userId)).thenReturn(new SubscriptionContext(
                orgId, UUID.randomUUID(), SubscriptionPlan.FREE, SubscriptionStatus.ACTIVE, null));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(billingPeriodService.resolvePeriodStart(any())).thenReturn(Instant.now().minus(1, ChronoUnit.DAYS));
        when(billingPeriodService.nextResetInstant(any())).thenReturn(Instant.now().plus(29, ChronoUnit.DAYS));
        when(orgUsageCounter.aiSkillRunsSince(eq(orgId), any())).thenReturn(100L);

        var response = usageLimitService.snapshot(userId);

        assertThat(response.jobDelivery().limit()).isEqualTo(-1);
        assertThat(response.jobDelivery().remaining()).isEqualTo(-1);
        assertThat(response.aiTokens().limit()).isEqualTo(-1);
        assertThat(response.aiTokens().remaining()).isEqualTo(-1);
        assertThat(response.skillRuns().limit()).isEqualTo(-1);
        assertThat(response.skillRuns().remaining()).isEqualTo(-1);
    }
}
