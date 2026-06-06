package com.careerops.service;

import com.careerops.dto.ConsentDtos.ConsentStatusResponse;
import com.careerops.dto.ConsentDtos.ConsentTypeStatus;
import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.UserConsent;
import com.careerops.model.UserConsent.ConsentType;
import com.careerops.repository.UserConsentRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private final UserConsentRepository repo;
    private final AuditLogService audit;

    public UserConsentService(UserConsentRepository repo, AuditLogService audit) {
        this.repo = repo;
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
