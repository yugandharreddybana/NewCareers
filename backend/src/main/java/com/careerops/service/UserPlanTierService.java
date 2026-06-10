package com.careerops.service;

import com.careerops.model.OrgMember;
import com.careerops.model.PlanTier;
import com.careerops.model.PlanTierMapper;
import com.careerops.model.UserProfile;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Resolves and persists user-scoped {@link PlanTier} from org subscription state.
 * Write-through cache on {@link UserProfile#planTier}; org-wide sync on billing changes.
 */
@Service
public class UserPlanTierService {

    private static final Logger log = LoggerFactory.getLogger(UserPlanTierService.class);

    private final OrganizationSubscriptionResolver subscriptionResolver;
    private final SubscriptionRepository subscriptionRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final UserProfileRepository userProfileRepository;

    public UserPlanTierService(
            @Lazy OrganizationSubscriptionResolver subscriptionResolver,
            SubscriptionRepository subscriptionRepository,
            OrgMemberRepository orgMemberRepository,
            UserProfileRepository userProfileRepository) {
        this.subscriptionResolver = subscriptionResolver;
        this.subscriptionRepository = subscriptionRepository;
        this.orgMemberRepository = orgMemberRepository;
        this.userProfileRepository = userProfileRepository;
    }

    /**
     * Effective tier for quota enforcement — uses subscription resolver effective plan.
     * Updates profile when it diverges from canonical subscription tier.
     */
    @Transactional
    public PlanTier resolveForUser(UUID userId) {
        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        PlanTier tier = PlanTierMapper.fromSubscription(PlanEnforcementService.effectivePlan(ctx));
        persistTierIfChanged(userId, tier);
        return tier;
    }

    /**
     * Tier from profile only — no subscription lookup. Falls back to FREE when profile missing.
     */
    @Transactional(readOnly = true)
    public PlanTier tierFromProfile(UUID userId) {
        return userProfileRepository.findByUserId(userId)
                .map(UserProfile::getPlanTier)
                .orElse(PlanTier.FREE);
    }

    /**
     * Sync all active org members after subscription plan change (webhook, admin, trial expiry).
     */
    @Transactional
    public void syncOrgMembersFromSubscription(UUID orgId) {
        subscriptionRepository.findByOrganizationId(orgId).ifPresent(subscription -> {
            SubscriptionContext ctx = new SubscriptionContext(
                    orgId,
                    subscription.getId(),
                    subscription.getPlan(),
                    subscription.getStatus(),
                    subscription.getTrialEndsAt());
            PlanTier tier = PlanTierMapper.fromSubscription(PlanEnforcementService.effectivePlan(ctx));
            for (OrgMember member : orgMemberRepository.findByOrgId(orgId)) {
                if (!"active".equals(member.getStatus())) {
                    continue;
                }
                persistTierIfChanged(member.getUserId(), tier);
            }
            log.debug("Synced plan tier {} for org {}", tier, orgId);
        });
    }

    private void persistTierIfChanged(UUID userId, PlanTier tier) {
        userProfileRepository.findByUserId(userId).ifPresent(profile -> {
            if (profile.getPlanTier() != tier) {
                profile.setPlanTier(tier);
                userProfileRepository.save(profile);
                log.info("Updated planTier userId={} tier={}", userId, tier);
            }
        });
    }
}
