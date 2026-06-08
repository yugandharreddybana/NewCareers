package com.careerops.service;

import com.careerops.model.PlanTier;
import com.careerops.repository.DailyFetchLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyLimitServiceTest {

    @Mock private DailyFetchLogRepository repo;
    @Mock private UserPlanTierService planTierService;

    @Test
    void maxFor_returnsTierCaps() {
        DailyLimitService limits = new DailyLimitService(repo, planTierService);
        assertThat(limits.maxFor(null)).isEqualTo(5);
        assertThat(limits.maxFor(PlanTier.FREE)).isEqualTo(5);
        assertThat(limits.maxFor(PlanTier.PRO)).isEqualTo(15);
        assertThat(limits.maxFor(PlanTier.PREMIUM)).isEqualTo(25);
    }

    @Test
    void max_unchanged_flatCap() {
        DailyLimitService limits = new DailyLimitService(repo, planTierService);
        ReflectionTestUtils.setField(limits, "maxPerDay", 25);
        assertThat(limits.max()).isEqualTo(25);
    }

    @Test
    void maxForUser_and_remaining_useResolvedTier() {
        UUID userId = UUID.randomUUID();
        DailyLimitService limits = new DailyLimitService(repo, planTierService);
        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.PRO);

        assertThat(limits.maxForUser(userId)).isEqualTo(15);
        assertThat(limits.remaining(userId)).isEqualTo(15);
    }
}
