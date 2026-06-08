package com.careerops.service;

import com.careerops.model.Organization;
import com.careerops.model.SubscriptionPlan;
import com.careerops.repository.OrgRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Keeps legacy {@link Organization#plan} aligned with the canonical {@code subscriptions} record.
 */
@Service
public class OrganizationPlanSyncService {

    private final OrgRepository orgRepository;
    private final UserPlanTierService userPlanTierService;

    public OrganizationPlanSyncService(
            OrgRepository orgRepository,
            UserPlanTierService userPlanTierService) {
        this.orgRepository = orgRepository;
        this.userPlanTierService = userPlanTierService;
    }

    @Transactional
    public void syncFromSubscription(UUID orgId, SubscriptionPlan plan) {
        orgRepository.findById(orgId).ifPresent(org -> {
            String legacyPlan = toLegacyOrgPlan(plan);
            if (!legacyPlan.equals(org.getPlan())) {
                org.setPlan(legacyPlan);
                orgRepository.save(org);
            }
        });
        userPlanTierService.syncOrgMembersFromSubscription(orgId);
    }

    static String toLegacyOrgPlan(SubscriptionPlan plan) {
        return switch (plan) {
            case ENTERPRISE -> "enterprise";
            case PRO -> "growth";
            case FREE -> "starter";
        };
    }
}
