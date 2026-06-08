package com.careerops.service;

import com.careerops.config.SaasBillingProperties;
import com.careerops.model.*;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrganizationSubscriptionResolverTest {

    @Mock
    private OrgRepository orgRepo;
    @Mock
    private OrgMemberRepository memberRepo;
    @Mock
    private SubscriptionRepository subscriptionRepo;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TrialProvisioningService trialProvisioningService;
    @Mock
    private OrganizationPlanSyncService organizationPlanSyncService;

    private OrganizationSubscriptionResolver resolver;
    private final UUID userId = UUID.randomUUID();
    private final SaasBillingProperties saasBillingProperties = new SaasBillingProperties();

    @BeforeEach
    void setUp() {
        resolver = new OrganizationSubscriptionResolver(
                orgRepo,
                memberRepo,
                subscriptionRepo,
                userRepository,
                trialProvisioningService,
                saasBillingProperties,
                organizationPlanSyncService);
    }

    @Test
    void resolveForUserReturnsExistingOrgSubscription() {
        UUID orgId = UUID.randomUUID();
        OrgMember owner = OrgMember.builder().orgId(orgId).userId(userId).role("owner").build();
        Subscription subscription = new Subscription();
        subscription.setId(UUID.randomUUID());
        subscription.setOrganizationId(orgId);
        subscription.setPlan(SubscriptionPlan.PRO);
        subscription.setStatus(SubscriptionStatus.ACTIVE);

        when(memberRepo.findByUserId(userId)).thenReturn(List.of(owner));
        when(subscriptionRepo.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));

        SubscriptionContext ctx = resolver.resolveForUser(userId);

        assertEquals(orgId, ctx.orgId());
        assertEquals(SubscriptionPlan.PRO, ctx.plan());
    }

    @Test
    void resolveForUserBootstrapsPersonalOrgWhenMissing() {
        UUID orgId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("alice@example.com");

        Instant trialEndsAt = Instant.now().plusSeconds(86_400L * 7);

        when(memberRepo.findByUserId(userId)).thenReturn(List.of());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(trialProvisioningService.provisionForNewUser(user))
                .thenReturn(new TrialProvisioningService.ProvisionResult(orgId, UUID.randomUUID(), trialEndsAt, true));

        Subscription subscription = new Subscription();
        subscription.setId(UUID.randomUUID());
        subscription.setOrganizationId(orgId);
        subscription.setPlan(SubscriptionPlan.FREE);
        subscription.setStatus(SubscriptionStatus.TRIALING);
        subscription.setTrialEndsAt(trialEndsAt);
        when(subscriptionRepo.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));

        SubscriptionContext ctx = resolver.resolveForUser(userId);

        assertEquals(orgId, ctx.orgId());
        assertEquals(SubscriptionPlan.FREE, ctx.plan());
        assertEquals(SubscriptionStatus.TRIALING, ctx.status());
        assertNotNull(ctx.trialEndsAt());
        verify(trialProvisioningService).provisionForNewUser(user);
    }

    @Test
    void mapLegacyOrgPlanMapsGrowthAndEnterprise() {
        assertEquals(SubscriptionPlan.FREE, OrganizationSubscriptionResolver.mapLegacyOrgPlan("starter"));
        assertEquals(SubscriptionPlan.PRO, OrganizationSubscriptionResolver.mapLegacyOrgPlan("growth"));
        assertEquals(SubscriptionPlan.ENTERPRISE, OrganizationSubscriptionResolver.mapLegacyOrgPlan("enterprise"));
    }
}
