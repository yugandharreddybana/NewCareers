package com.careerops.service;

import com.careerops.model.OrgMember;
import com.careerops.model.PlanTier;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.model.UserProfile;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserPlanTierServiceTest {

    @Mock OrganizationSubscriptionResolver subscriptionResolver;
    @Mock SubscriptionRepository subscriptionRepository;
    @Mock OrgMemberRepository orgMemberRepository;
    @Mock UserProfileRepository userProfileRepository;

    @InjectMocks UserPlanTierService service;

    @Test
    void resolveForUser_usesSubscriptionPlanAndPersistsProfile() {
        UUID userId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();
        SubscriptionContext ctx = new SubscriptionContext(
                orgId, UUID.randomUUID(), SubscriptionPlan.FREE, SubscriptionStatus.ACTIVE, null);
        UserProfile profile = UserProfile.builder().userId(userId).planTier(PlanTier.PRO).build();

        when(subscriptionResolver.resolveForUser(userId)).thenReturn(ctx);
        when(userProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        PlanTier tier = service.resolveForUser(userId);

        assertThat(tier).isEqualTo(PlanTier.FREE);
        assertThat(profile.getPlanTier()).isEqualTo(PlanTier.FREE);
        verify(userProfileRepository).save(profile);
    }

    @Test
    void syncOrgMembersFromSubscription_mapsEnterpriseToPremium() {
        UUID orgId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Subscription subscription = new Subscription();
        subscription.setId(UUID.randomUUID());
        subscription.setOrganizationId(orgId);
        subscription.setPlan(SubscriptionPlan.ENTERPRISE);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        UserProfile profile = UserProfile.builder().userId(userId).planTier(PlanTier.FREE).build();

        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(orgMemberRepository.findByOrgId(orgId))
                .thenReturn(List.of(OrgMember.builder().orgId(orgId).userId(userId).status("active").build()));
        when(userProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));

        service.syncOrgMembersFromSubscription(orgId);

        assertThat(profile.getPlanTier()).isEqualTo(PlanTier.PREMIUM);
        verify(userProfileRepository).save(profile);
    }
}
