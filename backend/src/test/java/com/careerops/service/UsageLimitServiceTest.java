package com.careerops.service;

import com.careerops.model.PlanTier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageLimitServiceTest {

    @Mock DailyLimitService dailyLimitService;
    @Mock TokenUsageService tokenUsageService;
    @Mock UserPlanTierService planTierService;

    private UsageLimitService usageLimitService;

    @BeforeEach
    void setUp() {
        usageLimitService = new UsageLimitService(dailyLimitService, tokenUsageService, planTierService);
    }

    @Test
    void snapshot_combinesJobAndAiQuotas() {
        UUID userId = UUID.randomUUID();
        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.PREMIUM);
        when(dailyLimitService.getCount(userId)).thenReturn(3);
        when(dailyLimitService.maxFor(PlanTier.PREMIUM)).thenReturn(25);
        when(dailyLimitService.remaining(userId)).thenReturn(22);
        when(tokenUsageService.tokensUsedSinceStartOfQuotaDay(userId)).thenReturn(120_000L);

        var response = usageLimitService.snapshot(userId);

        assertThat(response.jobDelivery().used()).isEqualTo(3);
        assertThat(response.jobDelivery().limit()).isEqualTo(25);
        assertThat(response.jobDelivery().remaining()).isEqualTo(22);
        assertThat(response.aiTokens().used()).isEqualTo(120_000);
        assertThat(response.aiTokens().limit()).isEqualTo(500_000);
        assertThat(response.aiTokens().remaining()).isEqualTo(380_000);
        assertThat(response.timezoneId()).isEqualTo("Europe/Dublin");
    }
}
