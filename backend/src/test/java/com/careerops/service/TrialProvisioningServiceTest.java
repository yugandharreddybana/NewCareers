package com.careerops.service;

import com.careerops.config.SaasBillingProperties;
import com.careerops.model.*;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrialProvisioningServiceTest {

    @Mock OrgRepository orgRepository;
    @Mock OrgMemberRepository memberRepository;
    @Mock SubscriptionRepository subscriptionRepository;
    @Mock SaasLifecycleTelemetry telemetry;
    @Mock TrialEmailService trialEmailService;

    private TrialProvisioningService service;
    private final SaasBillingProperties properties = new SaasBillingProperties();

    @BeforeEach
    void setUp() {
        properties.setTrialDays(7);
        service = new TrialProvisioningService(
                orgRepository, memberRepository, subscriptionRepository, properties, telemetry, trialEmailService);
    }

    @Test
    void provisionCreatesOrgSubscriptionAndTracksTrial() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("alice@example.com");
        user.setName("Alice Smith");

        UUID orgId = UUID.randomUUID();
        when(memberRepository.findByUserId(userId)).thenReturn(List.of());
        when(orgRepository.existsBySlug(any())).thenReturn(false);
        when(orgRepository.save(any(Organization.class))).thenAnswer(inv -> {
            Organization org = inv.getArgument(0);
            org.setId(orgId);
            assertEquals("alice's workspace", org.getName());
            return org;
        });
        when(subscriptionRepository.existsByOrganizationId(orgId)).thenReturn(false);
        when(subscriptionRepository.save(any(Subscription.class))).thenAnswer(inv -> {
            Subscription sub = inv.getArgument(0);
            sub.setId(UUID.randomUUID());
            return sub;
        });

        TrialProvisioningService.ProvisionResult result = service.provisionForNewUser(user);

        assertTrue(result.created());
        assertEquals(orgId, result.orgId());
        assertNotNull(result.trialEndsAt());

        verify(telemetry).trackTrialStarted(eq(userId), eq(orgId), any(Instant.class));
        verify(trialEmailService).sendWelcomeTrial(eq("alice@example.com"), eq("Alice"), any(Instant.class));

        ArgumentCaptor<OrgMember> memberCaptor = ArgumentCaptor.forClass(OrgMember.class);
        verify(memberRepository).save(memberCaptor.capture());
        assertEquals("owner", memberCaptor.getValue().getRole());
    }

    @Test
    void provisionIsIdempotentWhenOrgExists() {
        UUID userId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("bob@example.com");

        OrgMember owner = OrgMember.builder().orgId(orgId).userId(userId).role("owner").build();
        Subscription existing = new Subscription();
        existing.setId(UUID.randomUUID());
        existing.setOrganizationId(orgId);
        existing.setPlan(SubscriptionPlan.FREE);
        existing.setStatus(SubscriptionStatus.TRIALING);
        existing.setTrialEndsAt(Instant.now().plus(5, ChronoUnit.DAYS));

        when(memberRepository.findByUserId(userId)).thenReturn(List.of(owner));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(existing));

        TrialProvisioningService.ProvisionResult result = service.provisionForNewUser(user);

        assertFalse(result.created());
        verify(orgRepository, never()).save(any());
        verify(telemetry, never()).trackTrialStarted(any(), any(), any());
        verify(trialEmailService, never()).sendWelcomeTrial(any(), any(), any());
    }

    @Test
    void workspaceNameFromEmailSanitizesLocalPart() {
        assertEquals("john.doe's workspace", TrialProvisioningService.workspaceNameFromEmail("john.doe@x.com"));
        assertEquals("My workspace", TrialProvisioningService.workspaceNameFromEmail(""));
    }
}
