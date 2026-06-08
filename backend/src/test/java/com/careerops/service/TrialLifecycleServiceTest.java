package com.careerops.service;

import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.model.User;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrialLifecycleServiceTest {

    @Mock SubscriptionRepository subscriptionRepository;
    @Mock SaasLifecycleTelemetry lifecycleTelemetry;
    @Mock TrialEmailService trialEmailService;
    @Mock UserRepository userRepository;

    private TrialLifecycleService service;

    @BeforeEach
    void setUp() {
        service = new TrialLifecycleService(
                subscriptionRepository, lifecycleTelemetry, trialEmailService, userRepository);
    }

    @Test
    void downgradeExpiredTrialsSetsActiveFreeAndTracksEvent() {
        UUID orgId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();

        Subscription subscription = new Subscription();
        subscription.setId(UUID.randomUUID());
        subscription.setOrganizationId(orgId);
        subscription.setPlan(SubscriptionPlan.FREE);
        subscription.setStatus(SubscriptionStatus.TRIALING);
        subscription.setTrialEndsAt(Instant.now().minus(1, ChronoUnit.HOURS));

        User owner = new User();
        owner.setId(ownerId);
        owner.setEmail("owner@example.com");
        owner.setName("Owner User");

        when(subscriptionRepository.findExpiredTrialing(SubscriptionStatus.TRIALING, any(Instant.class)))
                .thenReturn(List.of(subscription));
        when(lifecycleTelemetry.findOrgOwnerUserId(orgId)).thenReturn(Optional.of(ownerId));
        when(userRepository.findById(ownerId)).thenReturn(Optional.of(owner));

        service.downgradeExpiredTrials();

        assertEquals(SubscriptionStatus.ACTIVE, subscription.getStatus());
        assertEquals(SubscriptionPlan.FREE, subscription.getPlan());
        verify(subscriptionRepository).save(subscription);
        verify(lifecycleTelemetry).trackTrialEnded(ownerId, orgId);
        verify(trialEmailService).sendTrialEndedUpgrade("owner@example.com", "Owner");
    }
}
