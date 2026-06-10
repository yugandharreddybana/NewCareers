package com.careerops.service;

import com.careerops.config.SaasBillingProperties;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.repository.AiTokenUsageRepository;
import com.careerops.repository.FeatureFlagRepository;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminSaasServiceTest {

    @Mock UserRepository userRepository;
    @Mock SubscriptionRepository subscriptionRepository;
    @Mock FeatureFlagRepository featureFlagRepository;
    @Mock AiTokenUsageRepository aiTokenUsageRepository;
    @Mock OrgRepository orgRepository;
    @Mock BillingStripeSyncService billingStripeSyncService;
    @Mock OrganizationPlanSyncService organizationPlanSyncService;

    SaasBillingProperties saasBillingProperties = new SaasBillingProperties();
    AdminSaasService service;

    @BeforeEach
    void setUp() {
        service = new AdminSaasService(
                userRepository,
                subscriptionRepository,
                featureFlagRepository,
                aiTokenUsageRepository,
                orgRepository,
                saasBillingProperties,
                billingStripeSyncService,
                organizationPlanSyncService);
    }

    @Test
    @DisplayName("MRR sums ACTIVE subscriptions by configured plan prices")
    void mrrCalculation() {
        when(userRepository.countByDeletedAtIsNull()).thenReturn(100L);
        when(subscriptionRepository.countByStatus(SubscriptionStatus.ACTIVE)).thenReturn(42L);
        when(subscriptionRepository.countActiveGroupByPlan()).thenReturn(List.of(
                new Object[] { SubscriptionPlan.PRO, 3L },
                new Object[] { SubscriptionPlan.ENTERPRISE, 1L },
                new Object[] { SubscriptionPlan.FREE, 5L }));
        when(subscriptionRepository.countCancelledSince(org.mockito.ArgumentMatchers.any())).thenReturn(1L);

        var metrics = service.getMetrics();

        // 3*19 + 1*299 + 5*0 = 356
        assertThat(metrics.mrr()).isEqualByComparingTo(new BigDecimal("356.00"));
        assertThat(metrics.totalUsers()).isEqualTo(100L);
        assertThat(metrics.activeSubscriptions()).isEqualTo(42L);
    }

    @Test
    @DisplayName("activeSubscriptions counts ACTIVE rows only")
    void activeSubscriptionsVsMrrDrift() {
        when(userRepository.countByDeletedAtIsNull()).thenReturn(50L);
        when(subscriptionRepository.countByStatus(SubscriptionStatus.ACTIVE)).thenReturn(12L);
        when(subscriptionRepository.countActiveGroupByPlan()).thenReturn(List.of(
                new Object[] { SubscriptionPlan.PRO, 2L },
                new Object[] { SubscriptionPlan.ENTERPRISE, 1L }));
        when(subscriptionRepository.countCancelledSince(org.mockito.ArgumentMatchers.any())).thenReturn(0L);

        var metrics = service.getMetrics();

        assertThat(metrics.activeSubscriptions()).isEqualTo(12L);
        assertThat(metrics.mrr()).isEqualByComparingTo(new BigDecimal("337.00"));
    }

    @Test
    @DisplayName("Churn denominator uses max(1, active + cancelled) to avoid divide-by-zero")
    void churnDenominatorEdgeCase() {
        when(userRepository.countByDeletedAtIsNull()).thenReturn(0L);
        when(subscriptionRepository.countByStatus(SubscriptionStatus.ACTIVE)).thenReturn(0L);
        when(subscriptionRepository.countActiveGroupByPlan()).thenReturn(List.of());
        when(subscriptionRepository.countCancelledSince(org.mockito.ArgumentMatchers.any())).thenReturn(0L);

        var metrics = service.getMetrics();

        assertThat(metrics.churnRatePercent()).isEqualTo(0.0);
        assertThat(metrics.trialConversionRatePercent()).isEqualTo(0.0);
    }
}
