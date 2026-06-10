package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.repository.AiTokenUsageRepository;
import com.careerops.repository.AuditLogRepository;
import com.careerops.repository.CareerMemoryRepository;
import com.careerops.repository.SkillConversationRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class UserAnonymizationService {

    private static final Logger log = LoggerFactory.getLogger(UserAnonymizationService.class);

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final AuthService authService;
    private final CvService cvService;
    private final SupabaseStorageService storage;
    private final AuditLogService audit;
    private final AuditLogRepository auditLogs;
    private final SkillRunRepository skillRuns;
    private final AiTokenUsageRepository tokenUsage;
    private final CareerMemoryRepository careerMemories;
    private final SkillConversationRepository skillConversations;
    private final OrgMemberRepository orgMembers;
    private final SubscriptionRepository subscriptions;
    private final BillingStripeSyncService billingStripeSync;
    private final OrganizationPlanSyncService organizationPlanSyncService;

    public UserAnonymizationService(
            UserRepository users,
            UserProfileRepository profiles,
            AuthService authService,
            CvService cvService,
            SupabaseStorageService storage,
            AuditLogService audit,
            AuditLogRepository auditLogs,
            SkillRunRepository skillRuns,
            AiTokenUsageRepository tokenUsage,
            CareerMemoryRepository careerMemories,
            SkillConversationRepository skillConversations,
            OrgMemberRepository orgMembers,
            SubscriptionRepository subscriptions,
            BillingStripeSyncService billingStripeSync,
            OrganizationPlanSyncService organizationPlanSyncService) {
        this.users = users;
        this.profiles = profiles;
        this.authService = authService;
        this.cvService = cvService;
        this.storage = storage;
        this.audit = audit;
        this.auditLogs = auditLogs;
        this.skillRuns = skillRuns;
        this.tokenUsage = tokenUsage;
        this.careerMemories = careerMemories;
        this.skillConversations = skillConversations;
        this.orgMembers = orgMembers;
        this.subscriptions = subscriptions;
        this.billingStripeSync = billingStripeSync;
        this.organizationPlanSyncService = organizationPlanSyncService;
    }

    @Transactional(timeout = 30)
    public void anonymizeAndDelete(UUID userId, HttpServletRequest request) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if (user.getDeletedAt() != null) {
            throw ApiException.conflict("Account is already deleted");
        }

        authService.revokeAllTokensForUser(userId);

        cancelBillingForOwnedOrganizations(userId);

        cvService.deleteAllForUser(userId);

        scrubProfile(userId);

        Instant deletedAt = Instant.now();
        String shortId = userId.toString().substring(0, 8);
        user.setEmail("deleted_" + userId + "@redacted.invalid");
        user.setName("Deleted User");
        user.setUsername("del_" + shortId);
        user.setPasswordHash(null);
        user.setGoogleSub(null);
        user.setDeletedAt(deletedAt);
        users.save(user);

        int skillRunsDeleted = skillRuns.deleteAllByUserId(userId);
        tokenUsage.deleteAllByUserId(userId);
        careerMemories.deleteByUserId(userId);
        int conversationsDeleted = skillConversations.deleteAllByUserId(userId);
        log.info("Deleted AI personal data for userId={}: skillRuns={} conversations={}",
                userId, skillRunsDeleted, conversationsDeleted);

        audit.log(userId, "GDPR_ERASURE_COMPLETE", request, Map.of(
                "message", "Cascade deleted skill_runs, token_usage, career_memory for userId=" + userId));

        audit.log(userId, "ACCOUNT_DELETED_GDPR", request, Map.of("deletedAt", deletedAt.toString()));

        auditLogs.nullifyUserId(userId);

        try {
            storage.purgeUserFiles(userId);
        } catch (Exception e) {
            log.error("Non-fatal: failed to purge storage for userId={}: {}", userId, e.getMessage());
        }

        log.info("Anonymized and deleted userId={}", userId);
    }

    private void cancelBillingForOwnedOrganizations(UUID userId) {
        orgMembers.findByUserId(userId).stream()
                .filter(member -> "owner".equals(member.getRole()))
                .map(member -> subscriptions.findByOrganizationId(member.getOrgId()).orElse(null))
                .filter(sub -> sub != null)
                .forEach(this::cancelAndScrubSubscription);
    }

    private void cancelAndScrubSubscription(Subscription subscription) {
        billingStripeSync.cancelAndDetachStripe(subscription);
        subscription.setPlan(SubscriptionPlan.FREE);
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        subscription.setCurrentPeriodEnd(null);
        subscription.setTrialEndsAt(null);
        subscription.setCancelAtPeriodEnd(false);
        subscriptions.save(subscription);
        organizationPlanSyncService.syncFromSubscription(subscription.getOrganizationId(), SubscriptionPlan.FREE);
    }

    private void scrubProfile(UUID userId) {
        profiles.findByUserId(userId).ifPresent(p -> {
            p.setLocation(null);
            p.setTargetRoles(null);
            p.setTechStack(null);
            p.setSalaryMin(null);
            p.setSalaryMax(null);
            p.setWorkExperience(java.util.List.of());
            p.setEducation(java.util.List.of());
            p.setPortfolioItems(java.util.List.of());
            p.setGoalTitle(null);
            p.setGoalLocation(null);
            p.setOnboardingDelivery(null);
            profiles.save(p);
        });
    }
}
