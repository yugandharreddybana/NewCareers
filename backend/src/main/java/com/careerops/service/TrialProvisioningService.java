package com.careerops.service;

import com.careerops.config.SaasBillingProperties;
import com.careerops.model.OrgMember;
import com.careerops.model.Organization;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.model.User;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class TrialProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(TrialProvisioningService.class);

    private final OrgRepository orgRepository;
    private final OrgMemberRepository memberRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final SaasBillingProperties saasBillingProperties;
    private final SaasLifecycleTelemetry telemetry;
    private final TrialEmailService trialEmailService;

    public TrialProvisioningService(
            OrgRepository orgRepository,
            OrgMemberRepository memberRepository,
            SubscriptionRepository subscriptionRepository,
            SaasBillingProperties saasBillingProperties,
            SaasLifecycleTelemetry telemetry,
            TrialEmailService trialEmailService) {
        this.orgRepository = orgRepository;
        this.memberRepository = memberRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.saasBillingProperties = saasBillingProperties;
        this.telemetry = telemetry;
        this.trialEmailService = trialEmailService;
    }

    public record ProvisionResult(UUID orgId, UUID subscriptionId, Instant trialEndsAt, boolean created) {}

    @Transactional
    public ProvisionResult provisionForNewUser(User user) {
        UUID existingOrgId = findPrimaryOrgId(user.getId());
        if (existingOrgId != null) {
            Subscription existing = subscriptionRepository.findByOrganizationId(existingOrgId)
                    .orElseGet(() -> createTrialSubscription(existingOrgId));
            return new ProvisionResult(existingOrgId, existing.getId(), existing.getTrialEndsAt(), false);
        }

        String workspaceName = workspaceNameFromEmail(user.getEmail());
        String slug = uniqueSlug("workspace-" + user.getId().toString().substring(0, 8));

        Organization org = orgRepository.save(Organization.builder()
                .name(workspaceName)
                .slug(slug)
                .plan("starter")
                .seatLimit(1)
                .build());

        memberRepository.save(OrgMember.builder()
                .orgId(org.getId())
                .userId(user.getId())
                .role("owner")
                .build());

        Subscription subscription = createTrialSubscription(org.getId());
        Instant trialEndsAt = subscription.getTrialEndsAt();

        telemetry.trackTrialStarted(user.getId(), org.getId(), trialEndsAt);

        String firstName = firstNameFromName(user.getName());
        try {
            trialEmailService.sendWelcomeTrial(user.getEmail(), firstName, trialEndsAt);
        } catch (Exception ex) {
            log.warn("Welcome trial email failed for user {}: {}", user.getId(), ex.getMessage());
        }

        return new ProvisionResult(org.getId(), subscription.getId(), trialEndsAt, true);
    }

    @Transactional
    public Subscription createTrialSubscription(UUID orgId) {
        if (subscriptionRepository.existsByOrganizationId(orgId)) {
            return subscriptionRepository.findByOrganizationId(orgId).orElseThrow();
        }
        Instant trialEndsAt = Instant.now().plus(saasBillingProperties.getTrialDays(), ChronoUnit.DAYS);
        Subscription subscription = new Subscription();
        subscription.setOrganizationId(orgId);
        subscription.setPlan(SubscriptionPlan.FREE);
        subscription.setStatus(SubscriptionStatus.TRIALING);
        subscription.setTrialEndsAt(trialEndsAt);
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

    private UUID findPrimaryOrgId(UUID userId) {
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

    private String uniqueSlug(String slugBase) {
        String slug = slugBase;
        int suffix = 0;
        while (orgRepository.existsBySlug(slug)) {
            suffix++;
            slug = slugBase + "-" + suffix;
        }
        return slug;
    }

    private static String firstNameFromName(String name) {
        if (name == null || name.isBlank()) {
            return "there";
        }
        return name.trim().split("\\s+")[0];
    }
}
