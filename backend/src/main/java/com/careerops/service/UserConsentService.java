package com.careerops.service;

import com.careerops.dto.ConsentDtos.ConsentStatusResponse;
import com.careerops.dto.ConsentDtos.ConsentTypeStatus;
import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import com.careerops.dto.ConsentDtos.WithdrawAiConsentResult;
import com.careerops.exception.ApiException;
import com.careerops.model.User;
import com.careerops.model.UserConsent;
import com.careerops.model.UserConsent.ConsentType;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserConsentRepository;
import com.careerops.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

/**
 * Append-only GDPR consent store. Latest row per type is authoritative.
 * ESSENTIAL is recorded at signup and cannot be withdrawn via API.
 */
@Service
public class UserConsentService {

    private static final String AI_CONSENT_MESSAGE =
            "AI processing consent is required. Enable it in Account settings under Privacy.";

    static final int SKILL_RUN_RETENTION_DAYS_ON_WITHDRAWAL = 30;

    private final UserConsentRepository repo;
    private final UserRepository users;
    private final SkillRunRepository skillRuns;
    private final AuditLogService audit;

    public UserConsentService(
            UserConsentRepository repo,
            UserRepository users,
            SkillRunRepository skillRuns,
            AuditLogService audit) {
        this.repo = repo;
        this.users = users;
        this.skillRuns = skillRuns;
        this.audit = audit;
    }

    public boolean hasConsent(UUID userId, ConsentType type) {
        return repo.findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(userId, type)
                .map(UserConsent::isAccepted)
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public ConsentStatusResponse getStatus(UUID userId) {
        return new ConsentStatusResponse(
                typeStatus(userId, ConsentType.ESSENTIAL),
                typeStatus(userId, ConsentType.AI_PROCESSING),
                typeStatus(userId, ConsentType.MARKETING),
                typeStatus(userId, ConsentType.ANALYTICS));
    }

    public void validateAiConsent(UUID userId) {
        if (!hasConsent(userId, ConsentType.AI_PROCESSING)) {
            throw new ApiException(HttpStatus.FORBIDDEN, AI_CONSENT_MESSAGE);
        }
    }

    public void requireMarketingConsent(UUID userId) {
        if (!hasConsent(userId, ConsentType.MARKETING)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Marketing email consent is required");
        }
    }

    public void requireAnalyticsConsent(UUID userId) {
        if (!hasConsent(userId, ConsentType.ANALYTICS)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Analytics consent is required");
        }
    }

    public boolean hasMarketingConsent(UUID userId) {
        return hasConsent(userId, ConsentType.MARKETING);
    }

    public boolean hasAnalyticsConsent(UUID userId) {
        return hasConsent(userId, ConsentType.ANALYTICS);
    }

    @Transactional
    public UserConsent recordConsent(
            UUID userId,
            ConsentType type,
            String version,
            boolean accepted,
            @Nullable HttpServletRequest request) {
        UserConsent row = UserConsent.builder()
                .userId(userId)
                .consentType(type)
                .version(version)
                .accepted(accepted)
                .ipAddress(resolveIp(request))
                .userAgent(request != null ? request.getHeader("User-Agent") : null)
                .build();
        UserConsent saved = repo.save(row);
        audit.log(userId, "CONSENT_RECORDED", request,
                Map.of("type", type.name(), "accepted", accepted, "version", version));
        return saved;
    }

    @Transactional
    public void recordSignupConsents(
            UUID userId,
            SignupConsentsRequest consents,
            @Nullable HttpServletRequest request) {
        String version = com.careerops.dto.ConsentDtos.CONSENT_VERSION;
        recordConsent(userId, ConsentType.ESSENTIAL, version, consents.termsAccepted(), request);
        recordConsent(userId, ConsentType.AI_PROCESSING, version, consents.aiProcessingAccepted(), request);
        recordConsent(userId, ConsentType.MARKETING, version, consents.marketingAccepted(), request);
        recordConsent(userId, ConsentType.ANALYTICS, version, consents.analyticsAccepted(), request);
    }

    @Transactional
    public UserConsent recordEssentialOnSignup(UUID userId, @Nullable HttpServletRequest request) {
        return recordConsent(userId, ConsentType.ESSENTIAL, com.careerops.dto.ConsentDtos.CONSENT_VERSION, true, request);
    }

    @Transactional
    public UserConsent updateConsent(
            UUID userId,
            ConsentType type,
            String version,
            boolean accepted,
            @Nullable HttpServletRequest request) {
        if (type == ConsentType.ESSENTIAL) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Essential consent cannot be changed");
        }
        if (type != ConsentType.AI_PROCESSING
                && type != ConsentType.MARKETING
                && type != ConsentType.ANALYTICS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported consent type");
        }
        return recordConsent(userId, type, version, accepted, request);
    }

    /**
     * GDPR Art. 7(3): dedicated AI withdrawal — append-only consent row, legacy column sync,
     * and purge of skill_runs older than {@link #SKILL_RUN_RETENTION_DAYS_ON_WITHDRAWAL} days.
     */
    @Transactional
    public WithdrawAiConsentResult withdrawAiConsent(UUID userId, @Nullable HttpServletRequest request) {
        boolean hadConsent = hasConsent(userId, ConsentType.AI_PROCESSING);
        UserConsent consentRow;

        if (hadConsent) {
            consentRow = recordConsent(
                    userId,
                    ConsentType.AI_PROCESSING,
                    com.careerops.dto.ConsentDtos.CONSENT_VERSION,
                    false,
                    request);
            syncLegacyAiConsentColumn(userId, false);
        } else {
            consentRow = repo.findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(
                            userId, ConsentType.AI_PROCESSING)
                    .orElseGet(() -> UserConsent.builder()
                            .userId(userId)
                            .consentType(ConsentType.AI_PROCESSING)
                            .version(com.careerops.dto.ConsentDtos.CONSENT_VERSION)
                            .accepted(false)
                            .acceptedAt(Instant.now())
                            .build());
        }

        Instant cutoff = Instant.now().minus(SKILL_RUN_RETENTION_DAYS_ON_WITHDRAWAL, ChronoUnit.DAYS);
        int skillRunsDeleted = skillRuns.deleteByUserIdAndCreatedAtBefore(userId, cutoff);

        if (hadConsent) {
            audit.log(userId, "AI_CONSENT_WITHDRAWN", request,
                    Map.of(
                            "version", com.careerops.dto.ConsentDtos.CONSENT_VERSION,
                            "skillRunsDeleted", skillRunsDeleted));
        }

        return new WithdrawAiConsentResult(consentRow, skillRunsDeleted);
    }

    private void syncLegacyAiConsentColumn(UUID userId, boolean accepted) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        user.setAiProcessingConsent(accepted);
        users.save(user);
    }

    private ConsentTypeStatus typeStatus(UUID userId, ConsentType type) {
        return repo.findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(userId, type)
                .map(c -> new ConsentTypeStatus(c.isAccepted(), c.getVersion(), c.getAcceptedAt()))
                .orElse(new ConsentTypeStatus(false, null, null));
    }

    private @Nullable String resolveIp(@Nullable HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
