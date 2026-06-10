package com.careerops.service;

import com.careerops.dto.AuthDtos.OnboardingOtpSentResponse;
import com.careerops.dto.AuthDtos.OnboardingVerificationResponse;
import com.careerops.exception.ApiException;
import com.careerops.model.EmailVerification;
import com.careerops.repository.EmailVerificationRepository;
import com.careerops.repository.UserRepository;
import com.careerops.security.OtpHashService;
import org.jspecify.annotations.Nullable;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;

@Service
public class OnboardingEmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(OnboardingEmailVerificationService.class);

    static final String GENERIC_VERIFY_FAILURE = "Invalid code.";
    static final String GENERIC_OTP_SEND_FAILURE = "Unable to send code. Please try again.";
    static final String GENERIC_SECURITY_FAILURE = "Security verification failed. Please try again.";

    private static final int OTP_EXPIRY_MINUTES = 15;
    private static final int SESSION_TTL_MINUTES = 15;
    private static final int RESEND_COOLDOWN_SECONDS = 300;
    private static final int MAX_RESENDS = 3;
    private static final int MAX_OTP_ATTEMPTS = 3;
    private static final int CAPTCHA_VALID_MINUTES = 15;

    private final EmailVerificationRepository verifications;
    private final UserRepository users;
    private final ResendEmailService email;
    private final CaptchaService captcha;
    private final OtpHashService otpHashService;
    private final boolean resendDevMode;
    private final String e2eTestEmail;
    private final Environment environment;

    public OnboardingEmailVerificationService(
            EmailVerificationRepository verifications,
            UserRepository users,
            ResendEmailService email,
            CaptchaService captcha,
            OtpHashService otpHashService,
            @Value("${resend.dev-mode:false}") boolean resendDevMode,
            @Value("${e2e.test.email:test@newcareer.com}") String e2eTestEmail,
            Environment environment) {
        this.verifications = verifications;
        this.users = users;
        this.email = email;
        this.captcha = captcha;
        this.otpHashService = otpHashService;
        this.resendDevMode = resendDevMode;
        this.e2eTestEmail = e2eTestEmail == null ? "" : e2eTestEmail.trim().toLowerCase(Locale.ROOT);
        this.environment = environment;
    }

    @Transactional(readOnly = true, timeout = 10)
    public void checkEmailAvailable(String rawEmail) {
        // M-11: always report available — enumeration resistance handled at sendOtp.
    }

    @Transactional(timeout = 10)
    public OnboardingOtpSentResponse sendOtp(String rawEmail, @Nullable String firstName, String captchaToken) {
        requireRecaptchaWhenConfigured(captchaToken);
        String lookupEmail = AuthService.normalizeEmail(rawEmail);
        boolean registered = users.findByEmail(lookupEmail).isPresent();
        Instant now = Instant.now();

        verifications.invalidateAllActiveForEmail(lookupEmail, now);

        String otp = registered ? generateRandomOtp() : generateOtpForEmail(lookupEmail);
        EmailVerification row = EmailVerification.builder()
                .email(lookupEmail)
                .otpHash(otpHashService.hash(otp))
                .expiresAt(now.plus(OTP_EXPIRY_MINUTES, ChronoUnit.MINUTES))
                .resendCount(0)
                .lastSentAt(now)
                .build();
        verifications.save(row);

        if (registered) {
            log.info("REGISTERED_EMAIL_OTP_DECOY email={}", lookupEmail);
        } else {
            String resolvedFirstName = resolveFirstName(firstName);
            email.sendOnboardingVerificationOtp(lookupEmail, otp, resolvedFirstName);
        }

        return new OnboardingOtpSentResponse(MAX_RESENDS, 0);
    }

    @Transactional(timeout = 10)
    public OnboardingOtpSentResponse resendOtp(String rawEmail, String captchaToken) {
        requireRecaptchaWhenConfigured(captchaToken);
        String lookupEmail = AuthService.normalizeEmail(rawEmail);
        EmailVerification row = verifications
                .findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(lookupEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, GENERIC_OTP_SEND_FAILURE));

        assertSessionActive(row);

        long secondsSinceLastSend = ChronoUnit.SECONDS.between(row.getLastSentAt(), Instant.now());
        if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
            int retryAfter = (int) (RESEND_COOLDOWN_SECONDS - secondsSinceLastSend);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, GENERIC_OTP_SEND_FAILURE, retryAfter);
        }

        if (row.getResendCount() >= MAX_RESENDS) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, GENERIC_OTP_SEND_FAILURE);
        }

        boolean registered = users.findByEmail(lookupEmail).isPresent();
        String otp = registered ? generateRandomOtp() : generateOtpForEmail(lookupEmail);
        Instant now = Instant.now();
        row.setOtpHash(otpHashService.hash(otp));
        row.setExpiresAt(now.plus(OTP_EXPIRY_MINUTES, ChronoUnit.MINUTES));
        row.setLastSentAt(now);
        row.setResendCount(row.getResendCount() + 1);
        row.setAttempts(0);
        row.setOtpVerifiedAt(null);
        row.setCaptchaVerifiedAt(null);
        verifications.save(row);

        if (!registered) {
            email.sendOnboardingVerificationOtp(lookupEmail, otp, null);
        }

        int remaining = MAX_RESENDS - row.getResendCount();
        return new OnboardingOtpSentResponse(remaining, 0);
    }

    @Transactional(timeout = 10)
    public OnboardingVerificationResponse verifyEmail(String rawEmail, String otp, String captchaToken) {
        String lookupEmail = AuthService.normalizeEmail(rawEmail);
        EmailVerification row = verifications
                .findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(lookupEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, GENERIC_VERIFY_FAILURE));

        assertSessionActive(row);

        if (Instant.now().isAfter(row.getExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_VERIFY_FAILURE);
        }

        if (row.getAttempts() >= MAX_OTP_ATTEMPTS) {
            row.setConsumedAt(Instant.now());
            verifications.saveAndFlush(row);
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_VERIFY_FAILURE);
        }

        if (!otpHashService.matches(otp, row.getOtpHash())) {
            verifications.incrementAttempts(row.getId());
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_VERIFY_FAILURE);
        }

        if (!isDevE2eBypassEmail(lookupEmail) && !captcha.verify(captchaToken)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_SECURITY_FAILURE);
        }

        Instant now = Instant.now();
        row.setOtpVerifiedAt(now);
        row.setCaptchaVerifiedAt(now);
        verifications.save(row);

        return new OnboardingVerificationResponse(row.getId());
    }

    @Transactional(timeout = 10)
    public void consumeForSignup(UUID verificationId, String rawEmail) {
        String lookupEmail = AuthService.normalizeEmail(rawEmail);
        Instant now = Instant.now();
        int updated = verifications.consumeForSignupIfEligible(
                verificationId,
                lookupEmail,
                now,
                now.minus(CAPTCHA_VALID_MINUTES, ChronoUnit.MINUTES),
                now.minus(SESSION_TTL_MINUTES, ChronoUnit.MINUTES));
        if (updated == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email verification required.");
        }
    }

    private void requireRecaptchaWhenConfigured(String captchaToken) {
        if (!captcha.isEnforcementActive()) {
            return;
        }
        if (captchaToken == null || captchaToken.isBlank() || !captcha.verify(captchaToken)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_SECURITY_FAILURE);
        }
    }

    private void assertSessionActive(EmailVerification row) {
        if (row.getCreatedAt().isBefore(Instant.now().minus(SESSION_TTL_MINUTES, ChronoUnit.MINUTES))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_VERIFY_FAILURE);
        }
    }

    private boolean isDevE2eBypassEmail(String lookupEmail) {
        boolean nonProdE2eDomain = environment.acceptsProfiles(Profiles.of("dev", "test"))
                && lookupEmail.endsWith("@careerops.test");
        return nonProdE2eDomain || (resendDevMode
                && (!e2eTestEmail.isEmpty() && lookupEmail.equalsIgnoreCase(e2eTestEmail)));
    }

    private String generateOtpForEmail(String lookupEmail) {
        if (isDevE2eBypassEmail(lookupEmail)) {
            return "00000000";
        }
        return generateRandomOtp();
    }

    private static String generateRandomOtp() {
        SecureRandom rnd = new SecureRandom();
        int code = 10_000_000 + rnd.nextInt(90_000_000);
        return String.format(Locale.ROOT, "%08d", code);
    }

    private static @Nullable String resolveFirstName(@Nullable String firstName) {
        if (firstName == null || firstName.isBlank()) {
            return null;
        }
        return firstName.trim().split("\\s+")[0];
    }
}
