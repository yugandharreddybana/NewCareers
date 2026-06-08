package com.careerops.service;

import com.careerops.config.SaasBillingProperties;
import com.careerops.model.*;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class OrganizationSubscriptionResolver {

    private final OrgRepository orgRepo;
    private final OrgMemberRepository memberRepo;
    private final SubscriptionRepository subscriptionRepo;
    private final UserRepository userRepository;
    private final TrialProvisioningService trialProvisioningService;
    private final SaasBillingProperties saasBillingProperties;

    public OrganizationSubscriptionResolver(
            OrgRepository orgRepo,
            OrgMemberRepository memberRepo,
            SubscriptionRepository subscriptionRepo,
            UserRepository userRepository,
            TrialProvisioningService trialProvisioningService,
            SaasBillingProperties saasBillingProperties) {
        this.orgRepo = orgRepo;
        this.memberRepo = memberRepo;
        this.subscriptionRepo = subscriptionRepo;
        this.userRepository = userRepository;
        this.trialProvisioningService = trialProvisioningService;
        this.saasBillingProperties = saasBillingProperties;
    }

    @Transactional
    public SubscriptionContext resolveForUser(UUID userId) {
        UUID resolvedOrgId = findPrimaryOrgId(userId);
        if (resolvedOrgId == null) {
            resolvedOrgId = bootstrapPersonalOrg(userId);
        }
        final UUID orgId = resolvedOrgId;
        Subscription subscription = subscriptionRepo.findByOrganizationId(orgId)
                .orElseGet(() -> trialProvisioningService.createTrialSubscription(orgId));
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
        subscription.setStatus(SubscriptionStatus.TRIALING);
        subscription.setTrialEndsAt(Instant.now().plus(saasBillingProperties.getTrialDays(), ChronoUnit.DAYS));
        return subscriptionRepo.save(subscription);
    }

    private UUID findPrimaryOrgId(UUID userId) {
        List<OrgMember> memberships = memberRepo.findByUserId(userId);
        if (memberships.isEmpty()) {
            return null;
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
        return trialProvisioningService.provisionForNewUser(user).orgId();
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
