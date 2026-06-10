package com.careerops.service;

import com.careerops.dto.AuthDtos.OnboardingOtpSentResponse;
import com.careerops.dto.AuthDtos.OnboardingVerificationResponse;
import com.careerops.exception.ApiException;
import com.careerops.model.EmailVerification;
import com.careerops.model.User;
import com.careerops.repository.EmailVerificationRepository;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OnboardingEmailVerificationServiceTest {

    @Mock EmailVerificationRepository verifications;
    @Mock UserRepository users;
    @Mock ResendEmailService email;
    @Mock CaptchaService captcha;
    @Mock com.careerops.security.OtpHashService otpHashService;
    @Mock Environment environment;

    OnboardingEmailVerificationService service;

    private static final String EMAIL = "new.user@example.com";
    private static final String REGISTERED_EMAIL = "existing.user@example.com";
    private UUID verificationId;

    @BeforeEach
    void setUp() {
        verificationId = UUID.randomUUID();
        service = new OnboardingEmailVerificationService(
                verifications,
                users,
                email,
                captcha,
                otpHashService,
                false,
                "test@newcareer.com",
                environment);
        lenient().when(otpHashService.hash(any())).thenAnswer(inv -> sha256(inv.getArgument(0)));
        lenient().when(otpHashService.matches(any(), any())).thenAnswer(inv -> {
            String otp = inv.getArgument(0);
            String hash = inv.getArgument(1);
            return sha256(otp).equals(hash);
        });
    }

    @Test
    @DisplayName("checkEmailAvailable returns silently when email already registered")
    void checkEmailAvailableIgnoresExistingUser() {
        service.checkEmailAvailable(EMAIL);

        verify(verifications, never()).save(any());
    }

    @Test
    @DisplayName("checkEmailAvailable succeeds when email is new")
    void checkEmailAvailableSuccess() {
        service.checkEmailAvailable(EMAIL);

        verify(verifications, never()).save(any());
        verify(email, never()).sendOnboardingVerificationOtp(any(), any(), any());
    }

    @Test
    @DisplayName("sendOtp creates decoy row when email already registered without sending email")
    void sendOtpDecoyForRegisteredUser() {
        when(users.findByEmail(REGISTERED_EMAIL))
                .thenReturn(Optional.of(User.builder().email(REGISTERED_EMAIL).build()));
        when(verifications.save(any(EmailVerification.class))).thenAnswer(inv -> inv.getArgument(0));

        OnboardingOtpSentResponse resp = service.sendOtp(REGISTERED_EMAIL, "New", null);

        assertThat(resp.resendsRemaining()).isEqualTo(3);
        verify(verifications).invalidateAllActiveForEmail(eq(REGISTERED_EMAIL), any(Instant.class));
        verify(verifications).save(any(EmailVerification.class));
        verify(email, never()).sendOnboardingVerificationOtp(any(), any(), any());
    }

    @Test
    @DisplayName("sendOtp creates verification row and sends email for new users")
    void sendOtpSuccess() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(verifications.save(any(EmailVerification.class))).thenAnswer(inv -> {
            EmailVerification ev = inv.getArgument(0);
            ev.setId(verificationId);
            return ev;
        });

        OnboardingOtpSentResponse resp = service.sendOtp(EMAIL, "New User", null);

        assertThat(resp.resendsRemaining()).isEqualTo(3);
        verify(verifications).invalidateAllActiveForEmail(eq(EMAIL), any(Instant.class));
        verify(email).sendOnboardingVerificationOtp(eq(EMAIL), any(String.class), eq("New"));
    }

    @Test
    @DisplayName("registered and unregistered emails get same generic error on bad OTP after send")
    void verifyEmailBadOtpSameMessageForRegisteredAndNew() {
        EmailVerification row = activeRow("11111111", 0);
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(REGISTERED_EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.verifyEmail(REGISTERED_EMAIL, "99999999", "captcha-token"))
                .isInstanceOf(ApiException.class)
                .hasMessage(OnboardingEmailVerificationService.GENERIC_VERIFY_FAILURE);

        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.verifyEmail(EMAIL, "99999999", "captcha-token"))
                .isInstanceOf(ApiException.class)
                .hasMessage(OnboardingEmailVerificationService.GENERIC_VERIFY_FAILURE);
    }

    @Test
    @DisplayName("resendOtp for registered email updates row without sending email")
    void resendOtpRegisteredSkipsEmail() {
        EmailVerification row = activeRow("12345678", 0);
        row.setLastSentAt(Instant.now().minus(6, ChronoUnit.MINUTES));
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(REGISTERED_EMAIL))
                .thenReturn(Optional.of(row));
        when(users.findByEmail(REGISTERED_EMAIL))
                .thenReturn(Optional.of(User.builder().email(REGISTERED_EMAIL).build()));
        when(verifications.save(row)).thenReturn(row);

        OnboardingOtpSentResponse resp = service.resendOtp(REGISTERED_EMAIL, null);

        assertThat(resp.resendsRemaining()).isEqualTo(2);
        verify(email, never()).sendOnboardingVerificationOtp(any(), any(), any());
    }

    @Test
    @DisplayName("resendOtp enforces cooldown with generic message")
    void resendOtpCooldown() {
        EmailVerification row = activeRow("12345678", 0);
        row.setLastSentAt(Instant.now().minus(1, ChronoUnit.MINUTES));
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.resendOtp(EMAIL, null))
                .isInstanceOf(ApiException.class)
                .hasMessage(OnboardingEmailVerificationService.GENERIC_OTP_SEND_FAILURE)
                .satisfies(ex -> {
                    ApiException api = (ApiException) ex;
                    assertThat(api.getRetryAfterSeconds()).isNotNull();
                });
    }

    @Test
    @DisplayName("resendOtp enforces max resends with generic message")
    void resendOtpMaxLimit() {
        EmailVerification row = activeRow("12345678", 3);
        row.setLastSentAt(Instant.now().minus(6, ChronoUnit.MINUTES));
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.resendOtp(EMAIL, null))
                .isInstanceOf(ApiException.class)
                .hasMessage(OnboardingEmailVerificationService.GENERIC_OTP_SEND_FAILURE);
    }

    @Test
    @DisplayName("verifyEmail validates OTP and CAPTCHA in one call")
    void verifyEmailSuccess() {
        String otp = "65432178";
        EmailVerification row = activeRow(otp, 0);
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));
        when(captcha.verify("captcha-token")).thenReturn(true);
        when(verifications.save(any(EmailVerification.class))).thenAnswer(inv -> inv.getArgument(0));

        OnboardingVerificationResponse resp = service.verifyEmail(EMAIL, otp, "captcha-token");

        assertThat(resp.verificationId()).isEqualTo(verificationId);
        assertThat(row.getOtpVerifiedAt()).isNotNull();
        assertThat(row.getCaptchaVerifiedAt()).isNotNull();
    }

    @Test
    @DisplayName("verifyEmail rejects invalid OTP and increments attempts")
    void verifyEmailInvalidOtp() {
        EmailVerification row = activeRow("11111111", 0);
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.verifyEmail(EMAIL, "99999999", "captcha-token"))
                .isInstanceOf(ApiException.class)
                .hasMessage(OnboardingEmailVerificationService.GENERIC_VERIFY_FAILURE);

        verify(verifications).incrementAttempts(verificationId);
        verify(captcha, never()).verify(any());
    }

    @Test
    @DisplayName("verifyEmail returns generic error when code expired")
    void verifyEmailExpired() {
        EmailVerification row = activeRow("11111111", 0);
        row.setExpiresAt(Instant.now().minus(1, ChronoUnit.MINUTES));
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.verifyEmail(EMAIL, "11111111", "captcha-token"))
                .isInstanceOf(ApiException.class)
                .hasMessage(OnboardingEmailVerificationService.GENERIC_VERIFY_FAILURE);
    }

    @Test
    @DisplayName("verifyEmail rejects bad CAPTCHA after valid OTP")
    void verifyEmailBadCaptcha() {
        String otp = "65432178";
        EmailVerification row = activeRow(otp, 0);
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));
        when(captcha.verify("bad")).thenReturn(false);

        assertThatThrownBy(() -> service.verifyEmail(EMAIL, otp, "bad"))
                .isInstanceOf(ApiException.class)
                .hasMessage(OnboardingEmailVerificationService.GENERIC_SECURITY_FAILURE);

        assertThat(row.getCaptchaVerifiedAt()).isNull();
    }

    @Test
    @DisplayName("consumeForSignup atomically marks verification consumed")
    void consumeForSignup() {
        when(verifications.consumeForSignupIfEligible(
                eq(verificationId), eq(EMAIL), any(Instant.class), any(Instant.class), any(Instant.class)))
                .thenReturn(1);

        service.consumeForSignup(verificationId, EMAIL);

        verify(verifications).consumeForSignupIfEligible(
                eq(verificationId), eq(EMAIL), any(Instant.class), any(Instant.class), any(Instant.class));
        verify(verifications, never()).save(any());
    }

    @Test
    @DisplayName("consumeForSignup rejects when atomic consume updates zero rows")
    void consumeForSignupRejectsIneligible() {
        when(verifications.consumeForSignupIfEligible(
                eq(verificationId), eq(EMAIL), any(Instant.class), any(Instant.class), any(Instant.class)))
                .thenReturn(0);

        assertThatThrownBy(() -> service.consumeForSignup(verificationId, EMAIL))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Email verification required");
    }

    private EmailVerification activeRow(String otp, int resendCount) {
        Instant now = Instant.now();
        return EmailVerification.builder()
                .id(verificationId)
                .email(EMAIL)
                .otpHash(sha256(otp))
                .expiresAt(now.plus(15, ChronoUnit.MINUTES))
                .resendCount(resendCount)
                .lastSentAt(now.minus(10, ChronoUnit.MINUTES))
                .createdAt(now.minus(2, ChronoUnit.MINUTES))
                .attempts(0)
                .build();
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
