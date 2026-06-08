package com.careerops.service;

import com.careerops.model.Organization;
import com.careerops.model.SubscriptionPlan;
import com.careerops.repository.OrgRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrganizationPlanSyncServiceTest {

    @Mock OrgRepository orgRepository;
    @Mock UserPlanTierService userPlanTierService;

    @InjectMocks OrganizationPlanSyncService service;

    @Test
    void syncUpdatesLegacyOrgPlanWhenDrifted() {
        UUID orgId = UUID.randomUUID();
        Organization org = Organization.builder().id(orgId).name("Acme").slug("acme").plan("starter").build();
        when(orgRepository.findById(orgId)).thenReturn(Optional.of(org));

        service.syncFromSubscription(orgId, SubscriptionPlan.PRO);

        assertThat(org.getPlan()).isEqualTo("growth");
        verify(orgRepository).save(org);
        verify(userPlanTierService).syncOrgMembersFromSubscription(orgId);
    }

    @Test
    void syncSkipsSaveWhenAlreadyAligned() {
        UUID orgId = UUID.randomUUID();
        Organization org = Organization.builder().id(orgId).name("Acme").slug("acme").plan("growth").build();
        when(orgRepository.findById(orgId)).thenReturn(Optional.of(org));

        service.syncFromSubscription(orgId, SubscriptionPlan.PRO);

        verify(orgRepository, never()).save(any());
        verify(userPlanTierService).syncOrgMembersFromSubscription(orgId);
    }
}
