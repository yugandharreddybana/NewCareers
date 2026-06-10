package com.careerops.service;

import com.careerops.dto.AuthDtos.SignupIntentRequest;
import com.careerops.dto.AuthDtos.SignupIntentResponse;
import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.SignupIntent;
import com.careerops.repository.SignupIntentRepository;
import com.careerops.repository.UserRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;

@Service
public class SignupIntentService {

    private static final Logger log = LoggerFactory.getLogger(SignupIntentService.class);
    private static final long TTL_MINUTES = 30;

    private final SignupIntentRepository intents;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final CaptchaService captcha;
    private final AuthService authService;

    public SignupIntentService(
            SignupIntentRepository intents,
            UserRepository users,
            PasswordEncoder encoder,
            CaptchaService captcha,
            @Lazy AuthService authService) {
        this.intents = intents;
        this.users = users;
        this.encoder = encoder;
        this.captcha = captcha;
        this.authService = authService;
    }

    @Transactional
    public SignupIntentResponse create(SignupIntentRequest req) {
        authService.requireRecaptchaWhenConfigured(req.captchaToken());
        if (req.consents() == null || !Boolean.TRUE.equals(req.consents().termsAccepted())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You must accept the Terms of Service");
        }
        if (!Boolean.TRUE.equals(req.consents().aiProcessingAccepted())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "AI processing consent is required to upload and parse your CV during onboarding.");
        }
        String email = normalizeEmail(req.email());
        if (users.existsByEmail(email)) {
            log.info("SIGNUP_INTENT_DECOY email={}", email);
            return new SignupIntentResponse(
                    UUID.randomUUID(),
                    Instant.now().plus(TTL_MINUTES, ChronoUnit.MINUTES));
        }
        authService.validateOnboardingPassword(req.password(), email);

        SignupConsentsRequest consents = req.consents();
        SignupIntent intent = intents.saveAndFlush(SignupIntent.builder()
                .email(email)
                .passwordHash(encoder.encode(req.password()))
                .name(trimOrNull(req.name()))
                .termsAccepted(Boolean.TRUE.equals(consents.termsAccepted()))
                .aiProcessingAccepted(Boolean.TRUE.equals(consents.aiProcessingAccepted()))
                .marketingAccepted(Boolean.TRUE.equals(consents.marketingAccepted()))
                .analyticsAccepted(Boolean.TRUE.equals(consents.analyticsAccepted()))
                .expiresAt(Instant.now().plus(TTL_MINUTES, ChronoUnit.MINUTES))
                .build());

        return new SignupIntentResponse(intent.getId(), intent.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public void assertValidForPasswordCheck(UUID signupIntentId, String rawEmail) {
        assertActiveIntent(signupIntentId, rawEmail);
    }

    /**
     * Validates a signup intent before stateless CV parse (L-14).
     */
    @Transactional(readOnly = true)
    public void assertEligibleForCvParse(UUID signupIntentId, String rawEmail) {
        SignupIntent intent = assertActiveIntent(signupIntentId, rawEmail);
        if (!intent.isAiProcessingAccepted()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI processing consent is required to parse your CV.");
        }
    }

    private SignupIntent assertActiveIntent(UUID signupIntentId, String rawEmail) {
        String normalized = normalizeEmail(rawEmail);
        SignupIntent intent = intents.findById(signupIntentId)
                .filter(candidate -> normalized.equals(candidate.getEmail()))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Sign-up session expired. Please start again."));

        Instant now = Instant.now();
        if (intent.getConsumedAt() != null || now.isAfter(intent.getExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Sign-up session expired. Please start again.");
        }
        return intent;
    }

    /**
     * Consumes a signup intent and returns the stored password hash for account creation.
     */
    @Transactional
    public ConsumedSignupIntent consume(UUID signupIntentId, String email) {
        String normalized = normalizeEmail(email);
        Instant now = Instant.now();
        int updated = intents.consumeIfActive(signupIntentId, normalized, now, now);
        if (updated == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Sign-up session expired. Please start again.");
        }

        SignupIntent intent = intents.findByIdAndEmail(signupIntentId, normalized)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Sign-up session expired. Please start again."));

        return new ConsumedSignupIntent(
                intent.getPasswordHash(),
                intent.getName(),
                new SignupConsentsRequest(
                        intent.isTermsAccepted(),
                        intent.isAiProcessingAccepted(),
                        intent.isMarketingAccepted(),
                        intent.isAnalyticsAccepted()));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String trimOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record ConsumedSignupIntent(
            String passwordHash,
            String name,
            SignupConsentsRequest consents) {}
}
