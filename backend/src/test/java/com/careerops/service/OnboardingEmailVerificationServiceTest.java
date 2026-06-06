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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OnboardingEmailVerificationServiceTest {

    @Mock EmailVerificationRepository verifications;
    @Mock UserRepository users;
    @Mock ResendEmailService email;
    @Mock CaptchaService captcha;

    @InjectMocks OnboardingEmailVerificationService service;

    private static final String EMAIL = "new.user@example.com";
    private UUID verificationId;

    @BeforeEach
    void setUp() {
        verificationId = UUID.randomUUID();
    }

    @Test
    @DisplayName("checkEmailAvailable rejects when email already registered")
    void checkEmailAvailableRejectsExistingUser() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(User.builder().email(EMAIL).build()));

        assertThatThrownBy(() -> service.checkEmailAvailable(EMAIL))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists");

        verify(verifications, never()).save(any());
    }

    @Test
    @DisplayName("checkEmailAvailable succeeds when email is new")
    void checkEmailAvailableSuccess() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        service.checkEmailAvailable(EMAIL);

        verify(verifications, never()).save(any());
        verify(email, never()).sendOnboardingVerificationOtp(any(), any(), any());
    }

    @Test
    @DisplayName("sendOtp rejects when email already registered")
    void sendOtpRejectsExistingUser() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(User.builder().email(EMAIL).build()));

        assertThatThrownBy(() -> service.sendOtp(EMAIL, "New"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists");

        verify(verifications, never()).save(any());
    }

    @Test
    @DisplayName("sendOtp creates verification row and sends email")
    void sendOtpSuccess() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(verifications.save(any(EmailVerification.class))).thenAnswer(inv -> {
            EmailVerification ev = inv.getArgument(0);
            ev.setId(verificationId);
            return ev;
        });

        OnboardingOtpSentResponse resp = service.sendOtp(EMAIL, "New User");

        assertThat(resp.resendsRemaining()).isEqualTo(3);
        verify(verifications).invalidateAllActiveForEmail(EMAIL);
        verify(email).sendOnboardingVerificationOtp(eq(EMAIL), any(String.class), eq("New"));
    }

    @Test
    @DisplayName("resendOtp enforces 5-minute cooldown")
    void resendOtpCooldown() {
        EmailVerification row = activeRow("123456", 0);
        row.setLastSentAt(Instant.now().minus(1, ChronoUnit.MINUTES));
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.resendOtp(EMAIL))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> {
                    ApiException api = (ApiException) ex;
                    assertThat(api.getRetryAfterSeconds()).isNotNull();
                });
    }

    @Test
    @DisplayName("resendOtp enforces max 3 resends")
    void resendOtpMaxLimit() {
        EmailVerification row = activeRow("123456", 3);
        row.setLastSentAt(Instant.now().minus(6, ChronoUnit.MINUTES));
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.resendOtp(EMAIL))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Resend limit");
    }

    @Test
    @DisplayName("verifyEmail validates OTP and CAPTCHA in one call")
    void verifyEmailSuccess() {
        String otp = "654321";
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
        EmailVerification row = activeRow("111111", 0);
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.verifyEmail(EMAIL, "999999", "captcha-token"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid code");

        verify(verifications).incrementAttempts(verificationId);
        verify(captcha, never()).verify(any());
    }

    @Test
    @DisplayName("verifyEmail rejects bad CAPTCHA after valid OTP")
    void verifyEmailBadCaptcha() {
        String otp = "654321";
        EmailVerification row = activeRow(otp, 0);
        when(verifications.findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(EMAIL))
                .thenReturn(Optional.of(row));
        when(captcha.verify("bad")).thenReturn(false);

        assertThatThrownBy(() -> service.verifyEmail(EMAIL, otp, "bad"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("CAPTCHA");

        assertThat(row.getCaptchaVerifiedAt()).isNull();
    }

    @Test
    @DisplayName("consumeForSignup marks verification consumed")
    void consumeForSignup() {
        EmailVerification row = activeRow("123456", 0);
        row.setOtpVerifiedAt(Instant.now());
        row.setCaptchaVerifiedAt(Instant.now());
        when(verifications.findByIdAndEmail(verificationId, EMAIL)).thenReturn(Optional.of(row));
        when(verifications.save(row)).thenReturn(row);

        service.consumeForSignup(verificationId, EMAIL);

        assertThat(row.getConsumedAt()).isNotNull();
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
