package com.careerops.dto;

import com.careerops.model.AiTokenUsage;
import com.careerops.model.AuditLog;
import com.careerops.model.SkillRun;
import com.careerops.model.User;
import com.careerops.model.UserConsent;
import com.careerops.model.UserCv;
import com.careerops.model.UserJob;
import com.careerops.model.Subscription;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * GDPR portability export payload. Excludes secrets ({@code passwordHash}, {@code googleSub})
 * and heavy binary fields ({@code UserCv.fileData}).
 */
public final class GdprExportDtos {

    private GdprExportDtos() {}

    public record GdprUserDataExport(
            Instant exportedAt,
            UserExport user,
            UserProfile profile,
            List<UserCvExport> cvs,
            List<UserJob> jobs,
            List<AuditLog> auditLogs,
            List<UserConsent> consents,
            @JsonProperty("skill_runs") List<SkillRunExport> skillRuns,
            @JsonProperty("token_usage") List<TokenUsageExport> tokenUsage,
            List<SubscriptionExport> subscriptions
    ) {}

    public record SubscriptionExport(
            UUID organizationId,
            String plan,
            String status,
            Instant trialEndsAt,
            Instant currentPeriodEnd,
            String stripeCustomerId,
            String stripeSubscriptionId) {

        public static SubscriptionExport from(Subscription subscription) {
            return new SubscriptionExport(
                    subscription.getOrganizationId(),
                    subscription.getPlan() != null ? subscription.getPlan().name() : null,
                    subscription.getStatus() != null ? subscription.getStatus().name() : null,
                    subscription.getTrialEndsAt(),
                    subscription.getCurrentPeriodEnd(),
                    subscription.getStripeCustomerId(),
                    subscription.getStripeSubscriptionId());
        }
    }

    public record SkillRunExport(
            UUID id,
            UUID userJobId,
            String skill,
            Instant createdAt,
            Instant expiresAt,
            JsonNode output,
            String resumeHtml
    ) {
        public static SkillRunExport from(SkillRun sr) {
            return new SkillRunExport(
                    sr.getId(),
                    sr.getUserJobId(),
                    sr.getSkill(),
                    sr.getCreatedAt(),
                    sr.getExpiresAt(),
                    sr.getOutput(),
                    sr.getResumeHtml());
        }
    }

    public record TokenUsageExport(
            String feature,
            String model,
            @JsonProperty("tokens_used") int tokensUsed,
            @JsonProperty("date") Instant date
    ) {
        public static TokenUsageExport from(AiTokenUsage tu) {
            return new TokenUsageExport(
                    tu.getFeature(),
                    tu.getModel(),
                    tu.getTotalTokens(),
                    tu.getCreatedAt());
        }
    }

    public record UserExport(
            UUID id,
            String name,
            String username,
            String email,
            User.AuthProvider authProvider,
            User.Role role,
            String locale,
            Instant createdAt,
            Instant emailVerifiedAt,
            Instant lastLoginAt
    ) {
        public static UserExport from(User user) {
            return new UserExport(
                    user.getId(),
                    user.getName(),
                    user.getUsername(),
                    user.getEmail(),
                    user.getAuthProvider(),
                    user.getRole(),
                    user.getLocale(),
                    user.getCreatedAt(),
                    user.getEmailVerifiedAt(),
                    user.getLastLoginAt());
        }
    }

    public record UserCvExport(
            UUID id,
            UUID userId,
            String fileName,
            String storagePath,
            String fileType,
            String parsedText,
            String cvMarkdown,
            JsonNode vectorJson,
            Instant uploadedAt,
            Boolean isActive
    ) {
        public static UserCvExport from(UserCv cv) {
            return new UserCvExport(
                    cv.getId(),
                    cv.getUserId(),
                    cv.getFileName(),
                    cv.getStoragePath(),
                    cv.getFileType(),
                    cv.getParsedText(),
                    cv.getCvMarkdown(),
                    cv.getVectorJson(),
                    cv.getUploadedAt(),
                    cv.getIsActive());
        }
    }
}
