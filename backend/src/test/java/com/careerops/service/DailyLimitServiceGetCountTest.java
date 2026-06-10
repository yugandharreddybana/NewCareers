package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.DailyFetchLogRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyLimitServiceGetCountTest {

    @Mock DailyFetchLogRepository fetchLogs;
    @Mock UserPlanTierService planTierService;
    @Mock UserQuotaGrantService quotaGrantService;
    @Mock UserJobRepository userJobs;
    @Mock JobRepository jobs;
    @Mock UserProfileRepository profiles;

    private DailyLimitService limits;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        limits = new DailyLimitService(
                fetchLogs, planTierService, quotaGrantService, userJobs, jobs, profiles);
    }

    @Test
    void getCount_matchesVisiblePipelineJobsOnly() {
        UserProfile profile = new UserProfile();
        profile.setMinMatchPercent(60);
        profile.setTargetRoles(new String[] {"Full Stack Developer"});

        UUID visibleJobId = UUID.randomUUID();
        UUID hiddenJobId = UUID.randomUUID();
        UserJob visible = UserJob.builder()
                .jobId(visibleJobId)
                .matchPercent(65)
                .deliveredAt(Instant.now())
                .build();
        UserJob hidden = UserJob.builder()
                .jobId(hiddenJobId)
                .matchPercent(45)
                .deliveredAt(Instant.now())
                .build();

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(userJobs.findActiveDeliveredSince(eq(userId), any())).thenReturn(List.of(visible, hidden));
        when(jobs.findAllById(any())).thenReturn(List.of(
                Job.builder().id(visibleJobId).title("Full Stack Developer").build(),
                Job.builder().id(hiddenJobId).title("Full Stack Developer").build()));

        assertThat(limits.getCount(userId)).isEqualTo(1);
    }
}
