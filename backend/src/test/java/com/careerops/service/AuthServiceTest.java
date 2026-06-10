package com.careerops.service;

import com.careerops.dto.AuthDtos.ForgotRequest;
import com.careerops.dto.AuthDtos.GoogleAuthRequest;
import com.careerops.dto.AuthDtos.GoogleLinkConfirmRequest;
import com.careerops.dto.AuthDtos.LoginRequest;
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
import com.careerops.security.AesFieldEncryptor;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
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
    @Mock SignupIntentService signupIntentService;
    @Mock com.careerops.security.OtpHashService otpHashService;
    @Mock org.springframework.core.env.Environment environment;
    @Mock OrgProvisioningService orgProvisioningService;
    @Mock AesFieldEncryptor fieldEncryptor;
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
        lenient().when(httpRequest.getHeader("User-Agent")).thenReturn("JUnit");
        lenient().when(httpRequest.getRemoteAddr()).thenReturn("127.0.0.1");
        lenient().when(fieldEncryptor.decrypt(any(), any())).thenAnswer(inv -> inv.getArgument(0));
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
                "Test User", "testuser", "signup@example.com", "Secure1Pass", defaultConsents, verificationId, null, null),
                httpRequest);

        verify(onboardingVerification).consumeForSignup(verificationId, "signup@example.com");

        verify(userKeyService).provisionForUser(any(UUID.class));
        verify(consentService).recordSignupConsents(userId, defaultConsents, httpRequest);
        verify(audit).log(eq(userId), eq("SIGNUP"), eq(httpRequest));
    }

    @Test
    @DisplayName("signup rejects when terms not accepted")
    void signupRejectsMissingTerms() {
        SignupConsentsRequest noTerms = new SignupConsentsRequest(false, true, false, false);

        assertThatThrownBy(() -> authService.signup(new SignupRequest(
                "Test User", "testuser", "signup@example.com", "Secure1Pass", noTerms, verificationId, null, null),
                httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Terms of Service");

        verify(consentService, never()).recordSignupConsents(any(), any(), any());
    }

    @Test
    @DisplayName("signup fails if org provisioning fails")
    void signupFailsWhenOrgProvisioningFails() {
        when(encoder.encode(any())).thenReturn("encoded-hash");
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(userId);
            return u;
        });
        doThrow(new IllegalStateException("billing unavailable"))
                .when(orgProvisioningService).provisionForNewUser(any(User.class));

        assertThatThrownBy(() -> authService.signup(new SignupRequest(
                "Test User", "testuser", "signup@example.com", "Secure1Pass", defaultConsents, verificationId, null, null),
                httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Account setup could not be completed");

        verify(jwt, never()).issue(any(), any());
    }

    @Test
    @DisplayName("signup rejects when email verification id missing")
    void signupRejectsMissingVerification() {
        assertThatThrownBy(() -> authService.signup(new SignupRequest(
                "Test User", "testuser", "signup@example.com", "Secure1Pass", defaultConsents, null, null, null),
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
                new GoogleAuthRequest(idToken, defaultConsents, null), httpRequest);

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

        authService.authenticateWithGoogle(new GoogleAuthRequest(idToken, defaultConsents, null), httpRequest);

        verify(consentService, never()).recordSignupConsents(any(), any(), any());
    }

    @Test
    @DisplayName("Google login on locked account returns generic failure")
    void googleLoginLockedAccountUsesGenericFailure() {
        String idToken = "d".repeat(120);
        user.setGoogleSub("locked-sub");
        user.setLockedUntil(Instant.now().plus(15, ChronoUnit.MINUTES));
        GoogleOAuthService.GoogleIdentity identity =
                new GoogleOAuthService.GoogleIdentity("locked-sub", user.getEmail(), user.getName(), true);

        when(googleOAuth.verifyIdToken(idToken)).thenReturn(identity);
        when(users.findByGoogleSub("locked-sub")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.authenticateWithGoogle(
                new GoogleAuthRequest(idToken, defaultConsents, null), httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid email or password");

        verify(jwt, never()).issue(any(), any());
    }

    @Test
    @DisplayName("Google login on password-only account requires link confirmation")
    void googleLinkRequiresVerificationForPasswordAccount() {
        String idToken = "c".repeat(120);
        user.setPasswordHash("hash");
        user.setGoogleSub(null);
        GoogleOAuthService.GoogleIdentity identity =
                new GoogleOAuthService.GoogleIdentity("new-google-sub", user.getEmail(), user.getName(), true);

        when(googleOAuth.verifyIdToken(idToken)).thenReturn(identity);
        when(users.findByGoogleSub("new-google-sub")).thenReturn(Optional.empty());
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.authenticateWithGoogle(
                new GoogleAuthRequest(idToken, defaultConsents, null), httpRequest))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getErrorCode())
                .isEqualTo("LINK_REQUIRES_VERIFICATION");

        verify(users, never()).save(any());
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
        String otp = "12345678";
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
                "test.user@example.com", "00000000", "N0tPwned!00000000Aa", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid code");

        verify(resets).incrementAttempts(pr.getId());
    }

    @Test
    @DisplayName("verifyOtp succeeds with valid OTP")
    void verifyOtpSuccess() {
        String otp = "87654321";
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
        String newPassword = "N0tPwned!87654321Aa";
        when(otpHashService.matches(otp, pr.getOtpHash())).thenReturn(true);
        when(encoder.matches(newPassword, "hash")).thenReturn(false);
        when(encoder.encode(newPassword)).thenReturn("new-hash");

        authService.verifyOtp(new VerifyOtpRequest(
                "test.user@example.com", otp, newPassword, null));

        verify(users).save(user);
        verify(refreshTokens).deleteByUserId(userId);
        assertThat(pr.isUsed()).isTrue();
    }

    @Test
    @DisplayName("logout revokes only supplied refresh token by default")
    void logoutRevokesSingleRefreshToken() {
        String rawRefresh = "refresh-token-value";
        authService.logout(userId, rawRefresh, "access-token", false, httpRequest);

        verify(jwt).revokeToken("access-token");
        verify(refreshTokens).deleteByTokenHash(any());
        verify(refreshTokens, never()).deleteByUserId(userId);
    }

    @Test
    @DisplayName("logout without refresh token skips refresh revocation unless logoutAll")
    void logoutWithoutRefreshSkipsFamilyRevocation() {
        authService.logout(userId, null, "access-token", false, httpRequest);

        verify(jwt).revokeToken("access-token");
        verify(refreshTokens, never()).deleteByUserId(userId);
        verify(refreshTokens, never()).deleteByTokenHash(any());
    }

    @Test
    @DisplayName("logoutAll clears every refresh token for the user")
    void logoutAllRevokesEveryRefreshToken() {
        authService.logout(userId, null, "access-token", true, httpRequest);

        verify(refreshTokens).deleteByUserId(userId);
    }

    @Test
    @DisplayName("verifyOtp returns generic error for unknown email")
    void verifyOtpUnknownEmail() {
        when(users.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyOtp(new VerifyOtpRequest(
                "unknown@example.com", "12345678", "N0tPwned!12345678Aa", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid code");
    }

    @Test
    @DisplayName("M-9: refresh rejects IP/UA binding mismatch and revokes token family")
    void refreshRejectsBindingMismatch() {
        UUID familyId = UUID.randomUUID();
        String rawToken = "refresh-token-raw-value";
        String storedHash = sha256(rawToken);
        String originalBinding = sha256("Mozilla/5.0|192.168.1.0");

        RefreshToken rt = RefreshToken.builder()
                .userId(userId)
                .tokenHash(storedHash)
                .tokenFamilyId(familyId)
                .bindingHash(originalBinding)
                .rememberMe(false)
                .expiresAt(Instant.now().plus(1, ChronoUnit.DAYS))
                .build();

        when(refreshTokens.findByTokenHashAndConsumedAtIsNull(storedHash)).thenReturn(Optional.of(rt));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(httpRequest.getHeader("User-Agent")).thenReturn("DifferentBrowser/1.0");
        when(httpRequest.getRemoteAddr()).thenReturn("10.0.0.5");

        assertThatThrownBy(() -> authService.refresh(rawToken, httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessage("Invalid or expired refresh token")
                .extracting(ex -> ((ApiException) ex).getStatus().value())
                .isEqualTo(401);

        verify(refreshTokens).deleteByTokenFamilyId(familyId);
        verify(refreshTokens, never()).save(any());
    }

    @Test
    @DisplayName("confirmGoogleLink returns generic error when account not found")
    void confirmGoogleLinkUnknownAccount() {
        var identity = new GoogleOAuthService.GoogleIdentity("sub-1", "missing@example.com", "Missing", true);
        when(googleOAuth.verifyIdToken("token")).thenReturn(identity);
        when(users.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.confirmGoogleLink(
                new GoogleLinkConfirmRequest("token", "Password1!", null), httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    @DisplayName("confirmGoogleLink returns generic error for wrong password")
    void confirmGoogleLinkWrongPassword() {
        var identity = new GoogleOAuthService.GoogleIdentity("sub-1", "test.user@example.com", "Test", true);
        when(googleOAuth.verifyIdToken("token")).thenReturn(identity);
        when(users.findByEmail("test.user@example.com")).thenReturn(Optional.of(user));
        when(encoder.matches("wrong", "hash")).thenReturn(false);

        assertThatThrownBy(() -> authService.confirmGoogleLink(
                new GoogleLinkConfirmRequest("token", "wrong", null), httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    @DisplayName("confirmGoogleLink returns generic error when account is locked")
    void confirmGoogleLinkLockedAccountUsesGenericFailure() {
        user.setLockedUntil(Instant.now().plus(15, ChronoUnit.MINUTES));
        var identity = new GoogleOAuthService.GoogleIdentity("sub-1", user.getEmail(), user.getName(), true);
        when(googleOAuth.verifyIdToken("token")).thenReturn(identity);
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.confirmGoogleLink(
                new GoogleLinkConfirmRequest("token", "Password1!", null), httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid email or password");

        verify(encoder, never()).matches(any(), any());
    }

    @Test
    @DisplayName("confirmGoogleLink returns generic error when Google sub mismatches")
    void confirmGoogleLinkWrongGoogleSub() {
        User linked = User.builder()
                .id(userId)
                .email("test.user@example.com")
                .passwordHash("hash")
                .googleSub("other-sub")
                .build();
        var identity = new GoogleOAuthService.GoogleIdentity("sub-1", "test.user@example.com", "Test", true);
        when(googleOAuth.verifyIdToken("token")).thenReturn(identity);
        when(users.findByEmail("test.user@example.com")).thenReturn(Optional.of(linked));

        assertThatThrownBy(() -> authService.confirmGoogleLink(
                new GoogleLinkConfirmRequest("token", "Password1!", null), httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    @DisplayName("login rejects deleted accounts with generic failure")
    void loginRejectedForDeletedUser() {
        User deleted = User.builder()
                .id(userId)
                .email("test.user@example.com")
                .passwordHash("hash")
                .deletedAt(Instant.now())
                .build();
        when(users.findByEmail("test.user@example.com")).thenReturn(Optional.of(deleted));
        when(encoder.matches("Password1!", "hash")).thenReturn(true);

        assertThatThrownBy(() -> authService.login(
                new LoginRequest("test.user@example.com", "Password1!", null, false),
                httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    @DisplayName("refresh returns generic error when user deleted")
    void refreshUserDeleted() {
        String rawToken = "refresh-token-raw-value";
        String storedHash = sha256(rawToken);
        RefreshToken rt = RefreshToken.builder()
                .userId(userId)
                .tokenHash(storedHash)
                .rememberMe(false)
                .expiresAt(Instant.now().plus(1, ChronoUnit.DAYS))
                .build();
        when(refreshTokens.findByTokenHashAndConsumedAtIsNull(storedHash)).thenReturn(Optional.of(rt));
        when(users.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refresh(rawToken, httpRequest))
                .isInstanceOf(ApiException.class)
                .hasMessage("Invalid or expired refresh token");
    }

    @Test
    @DisplayName("verifyOtp returns generic error when new password matches current")
    void verifyOtpSamePassword() {
        String otp = "12345678";
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
        when(otpHashService.matches(otp, pr.getOtpHash())).thenReturn(true);
        when(encoder.matches("SamePass1!", "hash")).thenReturn(true);

        assertThatThrownBy(() -> authService.verifyOtp(new VerifyOtpRequest(
                "test.user@example.com", otp, "SamePass1!", null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Unable to reset password. Please try again.");
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
