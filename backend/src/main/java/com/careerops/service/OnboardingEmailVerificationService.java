package com.careerops.service;

import com.careerops.dto.AuthDtos.OnboardingOtpSentResponse;
import com.careerops.dto.AuthDtos.OnboardingVerificationResponse;
import com.careerops.exception.ApiException;
import com.careerops.model.EmailVerification;
import com.careerops.repository.EmailVerificationRepository;
import com.careerops.repository.UserRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;

@Service
public class OnboardingEmailVerificationService {

    private static final int OTP_EXPIRY_MINUTES = 15;
    private static final int SESSION_TTL_MINUTES = 20;
    private static final int RESEND_COOLDOWN_SECONDS = 300;
    private static final int MAX_RESENDS = 3;
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final int CAPTCHA_VALID_MINUTES = 15;

    private final EmailVerificationRepository verifications;
    private final UserRepository users;
    private final ResendEmailService email;
    private final CaptchaService captcha;
    private final boolean resendDevMode;
    private final String e2eTestEmail;

    public OnboardingEmailVerificationService(
            EmailVerificationRepository verifications,
            UserRepository users,
            ResendEmailService email,
            CaptchaService captcha,
            @Value("${resend.dev-mode:false}") boolean resendDevMode,
            @Value("${e2e.test.email:test@newcareer.com}") String e2eTestEmail) {
        this.verifications = verifications;
        this.users = users;
        this.email = email;
        this.captcha = captcha;
        this.resendDevMode = resendDevMode;
        this.e2eTestEmail = e2eTestEmail == null ? "" : e2eTestEmail.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true, timeout = 10)
    public void checkEmailAvailable(String rawEmail) {
        assertEmailNotRegistered(rawEmail);
    }

    @Transactional(timeout = 10)
    public OnboardingOtpSentResponse sendOtp(String rawEmail, @Nullable String firstName) {
        assertEmailNotRegistered(rawEmail);
        String lookupEmail = AuthService.normalizeEmail(rawEmail);

        verifications.invalidateAllActiveForEmail(lookupEmail);

        String otp = generateOtpForEmail(lookupEmail);
        Instant now = Instant.now();
        EmailVerification row = EmailVerification.builder()
                .email(lookupEmail)
                .otpHash(sha256(otp))
                .expiresAt(now.plus(OTP_EXPIRY_MINUTES, ChronoUnit.MINUTES))
                .resendCount(0)
                .lastSentAt(now)
                .build();
        verifications.save(row);

        String resolvedFirstName = resolveFirstName(firstName);
        email.sendOnboardingVerificationOtp(lookupEmail, otp, resolvedFirstName);

        return new OnboardingOtpSentResponse(MAX_RESENDS, 0);
    }

    @Transactional(timeout = 10)
    public OnboardingOtpSentResponse resendOtp(String rawEmail) {
        String lookupEmail = AuthService.normalizeEmail(rawEmail);
        EmailVerification row = verifications
                .findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(lookupEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "No active verification session. Please start again from Complete profile."));

        assertSessionActive(row);

        long secondsSinceLastSend = ChronoUnit.SECONDS.between(row.getLastSentAt(), Instant.now());
        if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
            int retryAfter = (int) (RESEND_COOLDOWN_SECONDS - secondsSinceLastSend);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait before requesting a new code.", retryAfter);
        }

        if (row.getResendCount() >= MAX_RESENDS) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Resend limit reached. Please start signup again if you need a new code.");
        }

        String otp = generateOtpForEmail(lookupEmail);
        Instant now = Instant.now();
        row.setOtpHash(sha256(otp));
        row.setExpiresAt(now.plus(OTP_EXPIRY_MINUTES, ChronoUnit.MINUTES));
        row.setLastSentAt(now);
        row.setResendCount(row.getResendCount() + 1);
        row.setAttempts(0);
        row.setOtpVerifiedAt(null);
        row.setCaptchaVerifiedAt(null);
        verifications.save(row);

        email.sendOnboardingVerificationOtp(lookupEmail, otp, null);

        int remaining = MAX_RESENDS - row.getResendCount();
        return new OnboardingOtpSentResponse(remaining, 0);
    }

    @Transactional(timeout = 10)
    public OnboardingVerificationResponse verifyEmail(String rawEmail, String otp, String captchaToken) {
        String lookupEmail = AuthService.normalizeEmail(rawEmail);
        EmailVerification row = verifications
                .findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(lookupEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "No active verification session. Please request a new code."));

        assertSessionActive(row);

        if (Instant.now().isAfter(row.getExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Code expired — request a new one.");
        }

        if (row.getAttempts() >= MAX_OTP_ATTEMPTS) {
            row.setConsumedAt(Instant.now());
            verifications.saveAndFlush(row);
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Too many failed attempts. This code is no longer valid.");
        }

        String providedHash = sha256(otp);
        if (!MessageDigest.isEqual(row.getOtpHash().getBytes(StandardCharsets.UTF_8),
                providedHash.getBytes(StandardCharsets.UTF_8))) {
            verifications.incrementAttempts(row.getId());
            int remaining = MAX_OTP_ATTEMPTS - row.getAttempts() - 1;
            String msg = remaining > 0
                    ? "Invalid code. " + remaining + " attempt" + (remaining == 1 ? "" : "s") + " left."
                    : "Invalid code.";
            throw new ApiException(HttpStatus.BAD_REQUEST, msg);
        }

        if (!isDevE2eBypassEmail(lookupEmail) && !captcha.verify(captchaToken)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CAPTCHA verification failed. Please try again.");
        }

        Instant now = Instant.now();
        row.setOtpVerifiedAt(now);
        row.setCaptchaVerifiedAt(now);
        verifications.save(row);

        return new OnboardingVerificationResponse(row.getId());
    }

    /**
     * Validates a verification record for signup and marks it consumed.
     */
    @Transactional(timeout = 10)
    public void consumeForSignup(UUID verificationId, String rawEmail) {
        String lookupEmail = AuthService.normalizeEmail(rawEmail);
        EmailVerification row = verifications.findByIdAndEmail(verificationId, lookupEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Email verification required."));

        if (row.getConsumedAt() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This verification has already been used.");
        }

        if (row.getCaptchaVerifiedAt() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email verification required.");
        }

        if (row.getCaptchaVerifiedAt().isBefore(Instant.now().minus(CAPTCHA_VALID_MINUTES, ChronoUnit.MINUTES))) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Verification expired. Please verify your email again.");
        }

        assertSessionActive(row);
        row.setConsumedAt(Instant.now());
        verifications.save(row);
    }

    private void assertSessionActive(EmailVerification row) {
        if (row.getCreatedAt().isBefore(Instant.now().minus(SESSION_TTL_MINUTES, ChronoUnit.MINUTES))) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Verification session expired. Please start again from Complete profile.");
        }
    }

    private boolean isDevE2eBypassEmail(String lookupEmail) {
        return resendDevMode
                && (lookupEmail.endsWith("@careerops.test")
                || (!e2eTestEmail.isEmpty() && lookupEmail.equalsIgnoreCase(e2eTestEmail)));
    }

    private String generateOtpForEmail(String lookupEmail) {
        if (isDevE2eBypassEmail(lookupEmail)) {
            return "000000";
        }
        SecureRandom rnd = new SecureRandom();
        int code = 100_000 + rnd.nextInt(900_000);
        return String.format(Locale.ROOT, "%06d", code);
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] b = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(b.length * 2);
            for (byte x : b) {
                int val = x & 0xff;
                sb.append(Character.forDigit(val >> 4, 16));
                sb.append(Character.forDigit(val & 0xf, 16));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static @Nullable String resolveFirstName(@Nullable String firstName) {
        if (firstName == null || firstName.isBlank()) {
            return null;
        }
        return firstName.trim().split("\\s+")[0];
    }

    private void assertEmailNotRegistered(String rawEmail) {
        String lookupEmail = AuthService.normalizeEmail(rawEmail);
        if (users.findByEmail(lookupEmail).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "An account with this email already exists. Please sign in.");
        }
    }
}
