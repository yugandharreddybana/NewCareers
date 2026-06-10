package com.careerops.service;

import com.careerops.model.PlanTier;
import com.careerops.repository.DailyFetchLogRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyLimitServiceTest {

    @Mock private DailyFetchLogRepository repo;
    @Mock private UserPlanTierService planTierService;
    @Mock private UserQuotaGrantService quotaGrantService;
    @Mock private UserJobRepository userJobs;
    @Mock private JobRepository jobs;
    @Mock private UserProfileRepository profiles;

    @Test
    void maxFor_returnsTierCaps() {
        DailyLimitService limits = new DailyLimitService(
                repo, planTierService, quotaGrantService, userJobs, jobs, profiles);
        assertThat(limits.maxFor(null)).isEqualTo(5);
        assertThat(limits.maxFor(PlanTier.FREE)).isEqualTo(5);
        assertThat(limits.maxFor(PlanTier.PRO)).isEqualTo(15);
        assertThat(limits.maxFor(PlanTier.PREMIUM)).isEqualTo(25);
    }

    @Test
    void max_unchanged_flatCap() {
        DailyLimitService limits = new DailyLimitService(
                repo, planTierService, quotaGrantService, userJobs, jobs, profiles);
        ReflectionTestUtils.setField(limits, "maxPerDay", 25);
        assertThat(limits.max()).isEqualTo(25);
    }

    @Test
    void maxForUser_and_remaining_useResolvedTier() {
        UUID userId = UUID.randomUUID();
        DailyLimitService limits = new DailyLimitService(
                repo, planTierService, quotaGrantService, userJobs, jobs, profiles);
        when(planTierService.resolveForUser(userId)).thenReturn(PlanTier.PRO);
        when(quotaGrantService.jobsPerDay(userId, PlanTier.PRO)).thenReturn(15);
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        assertThat(limits.maxForUser(userId)).isEqualTo(15);
        assertThat(limits.remaining(userId)).isEqualTo(15);
    }
}
