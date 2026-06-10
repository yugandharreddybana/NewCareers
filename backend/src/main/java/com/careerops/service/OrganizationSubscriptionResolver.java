package com.careerops.service;

import com.careerops.model.*;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class OrganizationSubscriptionResolver {

    private final OrgRepository orgRepo;
    private final OrgMemberRepository memberRepo;
    private final SubscriptionRepository subscriptionRepo;
    private final UserRepository userRepository;
    private final OrgProvisioningService orgProvisioningService;
    private final OrganizationPlanSyncService organizationPlanSyncService;

    public OrganizationSubscriptionResolver(
            OrgRepository orgRepo,
            OrgMemberRepository memberRepo,
            SubscriptionRepository subscriptionRepo,
            UserRepository userRepository,
            OrgProvisioningService orgProvisioningService,
            OrganizationPlanSyncService organizationPlanSyncService) {
        this.orgRepo = orgRepo;
        this.memberRepo = memberRepo;
        this.subscriptionRepo = subscriptionRepo;
        this.userRepository = userRepository;
        this.orgProvisioningService = orgProvisioningService;
        this.organizationPlanSyncService = organizationPlanSyncService;
    }

    @Transactional
    public SubscriptionContext resolveForUser(UUID userId) {
        UUID resolvedOrgId = findPrimaryOrgId(userId);
        if (resolvedOrgId == null) {
            resolvedOrgId = bootstrapPersonalOrg(userId);
        }
        final UUID orgId = resolvedOrgId;
        Subscription subscription = subscriptionRepo.findByOrganizationId(orgId)
                .orElseGet(() -> orgProvisioningService.createFreeSubscription(orgId));
        return toContext(orgId, subscription);
    }

    @Transactional
    public Subscription createSubscriptionForOrg(UUID orgId, String legacyOrgPlan) {
        if (subscriptionRepo.existsByOrganizationId(orgId)) {
            return subscriptionRepo.findByOrganizationId(orgId).orElseThrow();
        }
        Subscription subscription = new Subscription();
        subscription.setOrganizationId(orgId);
        subscription.setPlan(mapLegacyOrgPlan(legacyOrgPlan));
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setTrialEndsAt(null);
        Subscription saved = subscriptionRepo.save(subscription);
        organizationPlanSyncService.syncFromSubscription(orgId, saved.getPlan());
        return saved;
    }

    private UUID findPrimaryOrgId(UUID userId) {
        List<OrgMember> memberships = memberRepo.findByUserId(userId);
        if (memberships.isEmpty()) {
            return null;
        }

        UUID preferred = userRepository.findById(userId)
                .map(User::getPrimaryBillingOrganizationId)
                .orElse(null);
        if (preferred != null) {
            boolean activeMember = memberships.stream()
                    .anyMatch(m -> preferred.equals(m.getOrgId()) && "active".equals(m.getStatus()));
            if (activeMember) {
                return preferred;
            }
        }

        return memberships.stream()
                .filter(m -> "active".equals(m.getStatus()))
                .sorted(Comparator.comparing(m -> "owner".equals(m.getRole()) ? 0 : 1))
                .map(OrgMember::getOrgId)
                .findFirst()
                .orElse(null);
    }

    private UUID bootstrapPersonalOrg(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found: " + userId));
        return orgProvisioningService.provisionForNewUser(user).orgId();
    }

    static SubscriptionPlan mapLegacyOrgPlan(String legacyPlan) {
        if (legacyPlan == null) {
            return SubscriptionPlan.FREE;
        }
        return switch (legacyPlan.toLowerCase()) {
            case "enterprise" -> SubscriptionPlan.ENTERPRISE;
            case "growth" -> SubscriptionPlan.PRO;
            default -> SubscriptionPlan.FREE;
        };
    }

    private static SubscriptionContext toContext(UUID orgId, Subscription subscription) {
        return new SubscriptionContext(
                orgId,
                subscription.getId(),
                subscription.getPlan(),
                subscription.getStatus(),
                subscription.getTrialEndsAt());
    }
}
