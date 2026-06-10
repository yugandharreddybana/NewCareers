package com.careerops.service;

import com.careerops.model.OrgMember;
import com.careerops.model.Organization;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.model.User;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrgProvisioningServiceTest {

    @Mock OrgRepository orgRepository;
    @Mock OrgMemberRepository memberRepository;
    @Mock SubscriptionRepository subscriptionRepository;
    @Mock UserRepository userRepository;

    @InjectMocks OrgProvisioningService service;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = User.builder()
                .id(userId)
                .email("dev@test.ie")
                .name("Dev User")
                .build();
    }

    @Test
    void provisionForNewUser_createsActiveFreeSubscription() {
        when(userRepository.findByIdForUpdate(userId)).thenReturn(Optional.of(user));
        when(memberRepository.findByUserId(userId)).thenReturn(List.of());
        when(orgRepository.existsBySlug(any())).thenReturn(false);
        when(orgRepository.save(any(Organization.class))).thenAnswer(inv -> {
            Organization org = inv.getArgument(0);
            org.setId(UUID.randomUUID());
            return org;
        });
        when(memberRepository.save(any(OrgMember.class))).thenAnswer(inv -> inv.getArgument(0));
        when(subscriptionRepository.existsByOrganizationId(any())).thenReturn(false);
        when(subscriptionRepository.save(any(Subscription.class))).thenAnswer(inv -> {
            Subscription sub = inv.getArgument(0);
            sub.setId(UUID.randomUUID());
            return sub;
        });
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        OrgProvisioningService.ProvisionResult result = service.provisionForNewUser(user);

        assertThat(result.created()).isTrue();

        ArgumentCaptor<Subscription> captor = ArgumentCaptor.forClass(Subscription.class);
        verify(subscriptionRepository).save(captor.capture());
        Subscription saved = captor.getValue();
        assertThat(saved.getPlan()).isEqualTo(SubscriptionPlan.FREE);
        assertThat(saved.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(saved.getTrialEndsAt()).isNull();

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getPrimaryBillingOrganizationId()).isNotNull();
    }

    @Test
    void provisionForNewUser_reusesExistingOrg() {
        UUID orgId = UUID.randomUUID();
        UUID subId = UUID.randomUUID();
        user.setPrimaryBillingOrganizationId(orgId);

        when(userRepository.findByIdForUpdate(userId)).thenReturn(Optional.of(user));
        when(memberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(OrgMember.builder().orgId(orgId).userId(userId).role("owner").status("active").build()));
        when(subscriptionRepository.findByOrganizationId(orgId))
                .thenReturn(Optional.of(activeFreeSub(orgId, subId)));

        OrgProvisioningService.ProvisionResult result = service.provisionForNewUser(user);

        assertThat(result.created()).isFalse();
        assertThat(result.orgId()).isEqualTo(orgId);
        assertThat(result.subscriptionId()).isEqualTo(subId);
        verify(orgRepository, never()).save(any());
    }

    private static Subscription activeFreeSub(UUID orgId, UUID subId) {
        Subscription sub = new Subscription();
        sub.setId(subId);
        sub.setOrganizationId(orgId);
        sub.setPlan(SubscriptionPlan.FREE);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        return sub;
    }
}
