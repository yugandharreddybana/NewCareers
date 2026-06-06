package com.careerops.service;

import com.careerops.dto.AuthDtos.ForgotRequest;
import com.careerops.dto.AuthDtos.GoogleAuthRequest;
import com.careerops.dto.AuthDtos.SignupRequest;
import com.careerops.dto.AuthDtos.VerifyOtpRequest;
import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.PasswordReset;
import com.careerops.model.RefreshToken;
import com.careerops.model.User;
import com.careerops.repository.PasswordResetRepository;
import com.careerops.repository.RefreshTokenRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.careerops.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import jakarta.servlet.http.HttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository users;
    @Mock UserProfileRepository profiles;
    @Mock PasswordResetRepository resets;
    @Mock PasswordEncoder encoder;
    @Mock JwtService jwt;
    @Mock ResendEmailService email;
    @Mock AuditLogService audit;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock CaptchaService captcha;
    @Mock WordCaptchaService wordCaptcha;
    @Mock com.careerops.repository.ReferralOutboxRepository referralOutbox;
    @Mock GoogleOAuthService googleOAuth;
    @Mock UserConsentService consentService;
    @Mock UserKeyService userKeyService;
    @Mock OnboardingEmailVerificationService onboardingVerification;
    @Mock HttpServletRequest httpRequest;

    @InjectMocks AuthService authService;

    private User user;
    private UUID userId;
    private UUID verificationId;
    private SignupConsentsRequest defaultConsents;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "refreshRememberDays", 30L);
        ReflectionTestUtils.setField(authService, "refreshSessionDays", 1L);

        userId = UUID.randomUUID();
        verificationId = UUID.randomUUID();
        user = User.builder()
                .id(userId)
                .name("Test User")
                .username("testuser")
                .email("Test.User@Example.COM")
                .passwordHash("hash")
                .build();
        defaultConsents = new SignupConsentsRequest(true, true, false, false);
    }

    @Test
    @DisplayName("email signup records all signup consents")
    void signupRecordsSignupConsents() {
        when(encoder.encode(any())).thenReturn("encoded-hash");
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(userId);
            return u;
        });
        when(jwt.issue(any(), any())).thenReturn("access-token");

        authService.signup(new SignupRequest(
                "Test User", "testuser", "signup@example.com", "Secure1Pass", defaultConsents, verificationId),
                httpRequest);

        verify(onboardingVerification).consumeForSignup(verificationId, "signup@example.com");

        verify(userKeyService).provisionForUser(any(UUID.class));
        verify(consentService).recordSignupConsents(userId, defaultConsents, httpRequest);
        verify(audit).log(eq(userId), eq("SIGNUP"), eq(httpRequest), any());
    }

    @Test
    @DisplayName("signup rejects when terms not accepted")
    void signupRejectsMissingTerms() {
        SignupConsentsRequest noTerms = new SignupConsentsRequest(false, true, false, false);

        assertThatThrownBy(() -> authService.signup(new SignupRequest(
                "Test User", "testuser", "signup@example.com", "Secure1Pass", noTerms, verificationId),
                httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Terms of Service");

        verify(consentService, never()).recordSignupConsents(any(), any(), any());
    }

    @Test
    @DisplayName("signup rejects when email verification id missing")
    void signupRejectsMissingVerification() {
        assertThatThrownBy(() -> authService.signup(new SignupRequest(
                "Test User", "testuser", "signup@example.com", "Secure1Pass", defaultConsents, null),
                httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Email verification required");

        verify(users, never()).save(any());
    }

    @Test
    @DisplayName("new Google user records signup consents")
    void newGoogleUserRecordsSignupConsents() {
        String idToken = "a".repeat(120);
        GoogleOAuthService.GoogleIdentity identity =
                new GoogleOAuthService.GoogleIdentity("google-sub", "google@example.com", "Google User", true);

        when(googleOAuth.verifyIdToken(idToken)).thenReturn(identity);
        when(users.findByGoogleSub("google-sub")).thenReturn(Optional.empty());
        when(users.findByEmail("google@example.com")).thenReturn(Optional.empty());
        when(users.existsByUsername(any())).thenReturn(false);
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(userId);
            return u;
        });
        when(jwt.issue(any(), any())).thenReturn("access-token");
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        authService.authenticateWithGoogle(
                new GoogleAuthRequest(idToken, defaultConsents), httpRequest);

        verify(userKeyService).provisionForUser(any(UUID.class));
        verify(consentService).recordSignupConsents(userId, defaultConsents, httpRequest);
    }

    @Test
    @DisplayName("existing Google user login does not record consent")
    void existingGoogleUserSkipsConsent() {
        String idToken = "b".repeat(120);
        user.setGoogleSub("existing-sub");
        GoogleOAuthService.GoogleIdentity identity =
                new GoogleOAuthService.GoogleIdentity("existing-sub", user.getEmail(), user.getName(), true);

        when(googleOAuth.verifyIdToken(idToken)).thenReturn(identity);
        when(users.findByGoogleSub("existing-sub")).thenReturn(Optional.of(user));
        when(jwt.issue(any(), any())).thenReturn("access-token");
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        authService.authenticateWithGoogle(new GoogleAuthRequest(idToken, defaultConsents), httpRequest);

        verify(consentService, never()).recordSignupConsents(any(), any(), any());
    }

    @Test
    @DisplayName("rememberMe=true issues ~30-day refresh token expiry")
    void rememberMeLongerRefreshExpiry() {
        when(jwt.issue(any(), any())).thenReturn("access-token");
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        ArgumentCaptor<RefreshToken> cap = ArgumentCaptor.forClass(RefreshToken.class);

        authService.createAuthResponse(user, null, true);
        verify(refreshTokens).save(cap.capture());

        Instant expected = Instant.now().plus(30, ChronoUnit.DAYS);
        assertThat(cap.getValue().getExpiresAt())
                .isCloseTo(expected, within(10, ChronoUnit.SECONDS));
    }

    @Test
    @DisplayName("rememberMe=false issues ~1-day refresh token expiry")
    void sessionRefreshExpiry() {
        when(jwt.issue(any(), any())).thenReturn("access-token");
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        ArgumentCaptor<RefreshToken> cap = ArgumentCaptor.forClass(RefreshToken.class);

        authService.createAuthResponse(user, null, false);
        verify(refreshTokens).save(cap.capture());

        Instant expected = Instant.now().plus(1, ChronoUnit.DAYS);
        assertThat(cap.getValue().getExpiresAt())
                .isCloseTo(expected, within(10, ChronoUnit.SECONDS));
    }

    @Test
    @DisplayName("forgot() stores normalized email and sends OTP")
    void forgotSendsOtpWithNormalizedEmail() {
        when(users.findByEmail("test.user@example.com")).thenReturn(Optional.of(user));

        authService.forgot(new ForgotRequest("  Test.User@Example.COM  "));

        ArgumentCaptor<PasswordReset> resetCap = ArgumentCaptor.forClass(PasswordReset.class);
        verify(resets).save(resetCap.capture());
        assertThat(resetCap.getValue().getEmail()).isEqualTo("test.user@example.com");

        verify(email).sendOtp(eq("test.user@example.com"), any(String.class), eq("Test"));
    }

    @Test
    @DisplayName("verifyOtp rejects invalid OTP")
    void verifyOtpInvalidCode() {
        String otp = "123456";
        PasswordReset pr = PasswordReset.builder()
                .userId(userId)
                .email("test.user@example.com")
                .otpHash(sha256(otp))
                .expiresAt(Instant.now().plus(10, ChronoUnit.MINUTES))
                .used(false)
                .attempts(0)
                .build();

        when(users.findByEmail("test.user@example.com")).thenReturn(Optional.of(user));
        when(resets.findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(userId))
                .thenReturn(Optional.of(pr));

        assertThatThrownBy(() -> authService.verifyOtp(new VerifyOtpRequest(
                "test.user@example.com", "000000", "N0tPwned!000000Aa")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid OTP");

        verify(resets).incrementAttempts(pr.getId());
    }

    @Test
    @DisplayName("verifyOtp succeeds with valid OTP")
    void verifyOtpSuccess() {
        String otp = "654321";
        PasswordReset pr = PasswordReset.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .email("test.user@example.com")
                .otpHash(sha256(otp))
                .expiresAt(Instant.now().plus(10, ChronoUnit.MINUTES))
                .used(false)
                .attempts(0)
                .build();

        when(users.findByEmail("test.user@example.com")).thenReturn(Optional.of(user));
        when(resets.findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(userId))
                .thenReturn(Optional.of(pr));
        String newPassword = "N0tPwned!654321Aa";
        when(encoder.matches(newPassword, "hash")).thenReturn(false);
        when(encoder.encode(newPassword)).thenReturn("new-hash");

        authService.verifyOtp(new VerifyOtpRequest(
                "test.user@example.com", otp, newPassword));

        verify(users).save(user);
        verify(refreshTokens).deleteByUserId(userId);
        assertThat(pr.isUsed()).isTrue();
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
