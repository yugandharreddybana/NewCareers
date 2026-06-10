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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class OrgProvisioningService {

    private final OrgRepository orgRepository;
    private final OrgMemberRepository memberRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;

    public OrgProvisioningService(
            OrgRepository orgRepository,
            OrgMemberRepository memberRepository,
            SubscriptionRepository subscriptionRepository,
            UserRepository userRepository) {
        this.orgRepository = orgRepository;
        this.memberRepository = memberRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
    }

    public record ProvisionResult(UUID orgId, UUID subscriptionId, boolean created) {}

    @Transactional
    public ProvisionResult provisionForNewUser(User user) {
        User lockedUser = userRepository.findByIdForUpdate(user.getId()).orElse(user);
        UUID existingOrgId = findPrimaryOrgId(lockedUser);
        if (existingOrgId != null) {
            Subscription existing = subscriptionRepository.findByOrganizationId(existingOrgId)
                    .orElseGet(() -> createFreeSubscription(existingOrgId));
            ensurePrimaryBillingOrg(lockedUser, existingOrgId);
            return new ProvisionResult(existingOrgId, existing.getId(), false);
        }

        String workspaceName = workspaceNameFromEmail(lockedUser.getEmail());
        String slug = uniqueSlug("workspace-" + lockedUser.getId().toString().substring(0, 8));

        Organization org = orgRepository.save(Organization.builder()
                .name(workspaceName)
                .slug(slug)
                .plan("starter")
                .seatLimit(1)
                .build());

        memberRepository.save(OrgMember.builder()
                .orgId(org.getId())
                .userId(lockedUser.getId())
                .role("owner")
                .build());

        Subscription subscription = createFreeSubscription(org.getId());
        ensurePrimaryBillingOrg(lockedUser, org.getId());

        return new ProvisionResult(org.getId(), subscription.getId(), true);
    }

    @Transactional
    public Subscription createFreeSubscription(UUID orgId) {
        if (subscriptionRepository.existsByOrganizationId(orgId)) {
            return subscriptionRepository.findByOrganizationId(orgId).orElseThrow();
        }
        Subscription subscription = new Subscription();
        subscription.setOrganizationId(orgId);
        subscription.setPlan(SubscriptionPlan.FREE);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setTrialEndsAt(null);
        return subscriptionRepository.save(subscription);
    }

    static String workspaceNameFromEmail(String email) {
        if (email == null || email.isBlank()) {
            return "My workspace";
        }
        int at = email.indexOf('@');
        String local = at > 0 ? email.substring(0, at).trim() : email.trim();
        if (local.isBlank()) {
            local = "my";
        }
        return local + "'s workspace";
    }

    private UUID findPrimaryOrgId(User user) {
        UUID primaryOrgId = user.getPrimaryBillingOrganizationId();
        if (primaryOrgId != null
                && memberRepository.findByOrgIdAndUserId(primaryOrgId, user.getId())
                        .filter(m -> "active".equals(m.getStatus()))
                        .isPresent()) {
            return primaryOrgId;
        }

        UUID userId = user.getId();
        List<OrgMember> memberships = memberRepository.findByUserId(userId);
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

    private void ensurePrimaryBillingOrg(User user, UUID orgId) {
        if (!orgId.equals(user.getPrimaryBillingOrganizationId())) {
            user.setPrimaryBillingOrganizationId(orgId);
            userRepository.save(user);
        }
    }

    private String uniqueSlug(String slugBase) {
        String slug = slugBase;
        int suffix = 0;
        while (orgRepository.existsBySlug(slug)) {
            suffix++;
            slug = slugBase + "-" + suffix;
        }
        return slug;
    }
}
