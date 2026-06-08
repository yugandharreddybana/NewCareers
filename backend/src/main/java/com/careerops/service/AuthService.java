package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.AuthDtos.*;
import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.PasswordReset;
import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.repository.PasswordResetRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.careerops.model.RefreshToken;
import com.careerops.repository.RefreshTokenRepository;
import com.careerops.security.JwtService;
import com.careerops.security.OtpHashService;
import com.careerops.security.TrustedProxyIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Task 117 — AuthService: issues refresh tokens on login (7-day expiry, stored
 * hashed),
 * rotates on every use, and blacklists on logout.
 * Access token expiry: 15 minutes (jwt.expiry.ms in application.properties).
 *
 * Batch 4 — added revokeAllTokensForUser(UUID) called by AccountController
 * before account deletion so tokens cannot be replayed after the user row is
 * removed.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String GENERIC_LOGIN_FAILURE = "Invalid email or password";
    private static final String GENERIC_RESET_CODE_FAILURE = "Invalid code.";
    private static final String GENERIC_REFRESH_FAILURE = "Invalid or expired refresh token";
    private static final String GENERIC_RESET_PASSWORD_FAILURE = "Unable to reset password. Please try again.";
    private static final String GENERIC_WEAK_PASSWORD = "This password is not secure enough. Please choose a different password.";
    private static final int MAX_REFRESH_TOKENS_PER_USER = 10;
    private static final int MAX_RESET_OTP_ATTEMPTS = 3;

    @org.springframework.beans.factory.annotation.Value("${auth.refresh.remember.days:30}")
    private long refreshRememberDays;

    @org.springframework.beans.factory.annotation.Value("${auth.refresh.session.days:1}")
    private long refreshSessionDays;

    @org.springframework.beans.factory.annotation.Value("${auth.login.word-captcha.required:false}")
    private boolean loginWordCaptchaRequired;

    @org.springframework.beans.factory.annotation.Value("${resend.dev-mode:false}")
    private boolean resendDevMode;

    @org.springframework.beans.factory.annotation.Value("${e2e.test.email:test@newcareer.com}")
    private String e2eTestEmail;

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final PasswordResetRepository resets;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final ResendEmailService email;
    private final AuditLogService audit;
    private final RefreshTokenRepository refreshTokens;
    private final CaptchaService captcha;
    private final WordCaptchaService wordCaptcha;
    private final com.careerops.repository.ReferralOutboxRepository referralOutbox;
    private final GoogleOAuthService googleOAuth;
    private final UserConsentService consentService;
    private final UserKeyService userKeyService;
    private final OnboardingEmailVerificationService onboardingVerification;
    private final SignupIntentService signupIntentService;
    private final OtpHashService otpHashService;
    private final Environment environment;
    private final TrialProvisioningService trialProvisioningService;
    private final TwoFactorService twoFactor;

    public AuthService(UserRepository users,
            UserProfileRepository profiles,
            PasswordResetRepository resets,
            PasswordEncoder encoder,
            JwtService jwt,
            ResendEmailService email,
            AuditLogService audit,
            RefreshTokenRepository refreshTokens,
            CaptchaService captcha,
            WordCaptchaService wordCaptcha,
            com.careerops.repository.ReferralOutboxRepository referralOutbox,
            GoogleOAuthService googleOAuth,
            UserConsentService consentService,
            UserKeyService userKeyService,
            OnboardingEmailVerificationService onboardingVerification,
            SignupIntentService signupIntentService,
            OtpHashService otpHashService,
            Environment environment,
            TrialProvisioningService trialProvisioningService,
            TwoFactorService twoFactor) {
        this.users = users;
        this.profiles = profiles;
        this.resets = resets;
        this.encoder = encoder;
        this.jwt = jwt;
        this.email = email;
        this.audit = audit;
        this.refreshTokens = refreshTokens;
        this.captcha = captcha;
        this.wordCaptcha = wordCaptcha;
        this.referralOutbox = referralOutbox;
        this.googleOAuth = googleOAuth;
        this.consentService = consentService;
        this.userKeyService = userKeyService;
        this.onboardingVerification = onboardingVerification;
        this.signupIntentService = signupIntentService;
        this.otpHashService = otpHashService;
        this.environment = environment;
        this.trialProvisioningService = trialProvisioningService;
        this.twoFactor = twoFactor;
    }

    // ─── Signup ────────────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public AuthResponse signup(SignupRequest req, @Nullable HttpServletRequest request) {
        String email = normalizeEmail(req.email());
        SignupConsentsRequest consents = req.consents();
        String passwordHash;

        if (req.signupIntentId() != null) {
            SignupIntentService.ConsumedSignupIntent consumed =
                    signupIntentService.consume(req.signupIntentId(), email);
            passwordHash = consumed.passwordHash();
            consents = consumed.consents();
        } else {
            if (req.password() == null || req.password().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Password or sign-up session required.");
            }
            if (consents == null || !Boolean.TRUE.equals(consents.termsAccepted())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "You must accept the Terms of Service");
            }
            checkPwnedPassword(req.password(), email, true);
            passwordHash = encoder.encode(req.password());
        }

        if (consents == null || !Boolean.TRUE.equals(consents.termsAccepted())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You must accept the Terms of Service");
        }
        try {
            if (req.emailVerificationId() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Email verification required.");
            }
            onboardingVerification.consumeForSignup(req.emailVerificationId(), email);

            UUID userId = UUID.randomUUID();
            User u = users.save(User.builder()
                    .id(userId)
                    .name(req.name())
                    .username(req.username())
                    .email(email)
                    .passwordHash(passwordHash)
                    .emailVerifiedAt(Instant.now())
                    .build());
            userKeyService.provisionForUser(userId);

            profiles.save(UserProfile.builder()
                    .userId(u.getId())
                    .location("Ireland")
                    .freshnessHours(96)
                    .minMatchPercent(UserProfile.DEFAULT_MIN_MATCH_PERCENT)
                    .sponsorshipRequired(false)
                    .openToRemote(true)
                    .onboarded(false)
                    .build());

            // 3.011 — Move referral handling onto an outbox table for reliable processing
            referralOutbox.save(com.careerops.model.ReferralOutbox.builder()
                    .refereeEmail(u.getEmail())
                    .refereeName(u.getName())
                    .build());

            consentService.recordSignupConsents(u.getId(), req.consents(), request);

            audit.log(u.getId(), "SIGNUP", request);

            provisionTrialSafely(u);

            String rawRefresh = issueRefreshToken(u, null, false);
            return new AuthResponse(jwt.issue(u.getId().toString(), u.getEmail()), rawRefresh, toDto(u, false));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 3.003 — Handle race condition where another request created the user between
            // exists check and save
            throw new ApiException(HttpStatus.CONFLICT, "Unable to create account");
        }
    }

    // ─── Google Sign-In ────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public AuthResponse authenticateWithGoogle(GoogleAuthRequest req, @Nullable HttpServletRequest httpRequest) {
        requireRecaptchaWhenConfigured(req.captchaToken());
        GoogleOAuthService.GoogleIdentity identity = googleOAuth.verifyIdToken(req.idToken());

        Optional<User> byGoogle = users.findByGoogleSub(identity.sub());
        User u;
        if (byGoogle.isPresent()) {
            u = byGoogle.get();
            assertAccountNotLockedForLogin(u);
            assertAccountActive(u);
        } else {
            Optional<User> byEmail = users.findByEmail(identity.email());
            if (byEmail.isPresent()) {
                u = byEmail.get();
                assertAccountNotLockedForLogin(u);
                assertAccountActive(u);
                if (u.getGoogleSub() != null && !u.getGoogleSub().equals(identity.sub())) {
                    throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE);
                }
                boolean hasLocalPassword = u.getPasswordHash() != null && !u.getPasswordHash().isBlank();
                if (hasLocalPassword && u.getGoogleSub() == null) {
                    throw new ApiException(HttpStatus.CONFLICT,
                            "This email already has a password. Confirm your password to link Google.",
                            "LINK_REQUIRES_VERIFICATION");
                }
                if (u.getGoogleSub() == null) {
                    u.setGoogleSub(identity.sub());
                    u.setAuthProvider(User.AuthProvider.GOOGLE);
                    if (u.getEmailVerifiedAt() == null) {
                        u.setEmailVerifiedAt(Instant.now());
                    }
                    users.save(u);
                }
            } else {
                u = createGoogleUser(identity, httpRequest, req.consents());
            }
        }

        assertAccountActive(u);
        users.resetFailedAttempts(u.getEmail());
        u.setLastLoginAt(Instant.now());
        users.save(u);

        audit.log(u.getId(), "GOOGLE_LOGIN", httpRequest);
        return createAuthResponse(u, httpRequest);
    }

    @Transactional(timeout = 10)
    public AuthResponse confirmGoogleLink(GoogleLinkConfirmRequest req, @Nullable HttpServletRequest httpRequest) {
        requireRecaptchaWhenConfigured(req.captchaToken());
        GoogleOAuthService.GoogleIdentity identity = googleOAuth.verifyIdToken(req.idToken());
        User u = users.findByEmail(identity.email()).orElse(null);

        if (u == null
                || u.getPasswordHash() == null
                || u.getPasswordHash().isBlank()
                || (u.getGoogleSub() != null && !u.getGoogleSub().equals(identity.sub()))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE);
        }
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE);
        }
        assertAccountActive(u);

        u.setGoogleSub(identity.sub());
        u.setAuthProvider(User.AuthProvider.GOOGLE);
        if (u.getEmailVerifiedAt() == null) {
            u.setEmailVerifiedAt(Instant.now());
        }
        users.resetFailedAttempts(u.getEmail());
        u.setLastLoginAt(Instant.now());
        users.save(u);

        audit.log(u.getId(), "GOOGLE_LINK_CONFIRM", httpRequest);
        return createAuthResponse(u, httpRequest);
    }

    private User createGoogleUser(
            GoogleOAuthService.GoogleIdentity identity,
            @Nullable HttpServletRequest httpRequest,
            @Nullable SignupConsentsRequest consents) {
        if (consents == null || !Boolean.TRUE.equals(consents.termsAccepted())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You must accept the Terms of Service");
        }
        if (!Boolean.TRUE.equals(consents.aiProcessingAccepted())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AI processing consent is required to create an account");
        }
        try {
            UUID userId = UUID.randomUUID();
            User u = users.save(User.builder()
                    .id(userId)
                    .name(identity.name())
                    .username(allocateUsername(identity.email()))
                    .email(identity.email())
                    .passwordHash(null)
                    .authProvider(User.AuthProvider.GOOGLE)
                    .googleSub(identity.sub())
                    .emailVerifiedAt(Instant.now())
                    .build());
            userKeyService.provisionForUser(userId);

            profiles.save(UserProfile.builder()
                    .userId(u.getId())
                    .location("Ireland")
                    .freshnessHours(96)
                    .minMatchPercent(UserProfile.DEFAULT_MIN_MATCH_PERCENT)
                    .sponsorshipRequired(false)
                    .openToRemote(true)
                    .onboarded(false)
                    .build());

            referralOutbox.save(com.careerops.model.ReferralOutbox.builder()
                    .refereeEmail(u.getEmail())
                    .refereeName(u.getName())
                    .build());

            consentService.recordSignupConsents(u.getId(), consents, httpRequest);

            audit.log(u.getId(), "GOOGLE_SIGNUP", httpRequest);

            provisionTrialSafely(u);

            return u;
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            User existing = users.findByGoogleSub(identity.sub())
                    .or(() -> users.findByEmail(identity.email()))
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                            "Could not create account. Please try again."));
            if (consents != null && !consentService.hasConsent(existing.getId(),
                    com.careerops.model.UserConsent.ConsentType.ESSENTIAL)) {
                consentService.recordSignupConsents(existing.getId(), consents, httpRequest);
            }
            return existing;
        }
    }

    private String allocateUsername(String email) {
        String local = email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9._-]", "");
        if (local.length() < 3) {
            local = "user" + local;
        }
        local = local.substring(0, Math.min(local.length(), 26));
        if (!users.existsByUsername(local)) {
            return local;
        }
        for (int i = 0; i < 8; i++) {
            String candidate = local + (1000 + new SecureRandom().nextInt(9000));
            if (!users.existsByUsername(candidate)) {
                return candidate.substring(0, Math.min(candidate.length(), 32));
            }
        }
        return local + UUID.randomUUID().toString().substring(0, 6);
    }

    // ─── Login ─────────────────────────────────────────────────────────────────

    // 3.001 — Pre-computed dummy hash for timing protection
    private static final String DUMMY_HASH = "$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGGa31S.";

    @Transactional(timeout = 10)
    public LoginFlowResponse login(LoginRequest req, @Nullable HttpServletRequest httpRequest) {
        String lookupEmail = normalizeEmail(req.email());
        User u = users.findByEmail(lookupEmail).orElse(null);

        // 3.002 — Brute-force protection: check lockout BEFORE password check
        if (u != null && u.getLockedUntil() != null && Instant.now().isBefore(u.getLockedUntil())) {
            encoder.matches(req.password(), DUMMY_HASH);
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE, true);
        }

        if (loginWordCaptchaRequired) {
            if (req.captchaToken() == null || req.captchaToken().isBlank()) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE, true);
            }
            if (!wordCaptcha.verifyToken(req.captchaToken())) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE, true);
            }
        }

        if (u != null && (u.getPasswordHash() == null || u.getPasswordHash().isBlank())) {
            encoder.matches(req.password(), DUMMY_HASH);
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE);
        }

        // 3.001 — Security: Always run BCrypt verify
        String hashToVerify = (u != null) ? u.getPasswordHash() : DUMMY_HASH;
        boolean passwordMatches = encoder.matches(req.password(), hashToVerify);

        if (u == null || !passwordMatches) {
            boolean captchaRequired = loginWordCaptchaRequired;
            if (u != null) {
                // 3.002 — Atomic increment ensures tracking even if login() rolls back
                users.incrementFailedAttempts(u.getEmail());

                // Fetch fresh copy to check thresholds
                User fresh = users.findByEmail(u.getEmail()).orElse(u);
                int attempts = fresh.getFailedLoginAttempts();

                if (attempts >= 5) {
                    users.lockAccount(u.getEmail(), Instant.now().plus(15, ChronoUnit.MINUTES));
                    log.info("Account locked for email={} after {} failures", u.getEmail(), attempts);
                    audit.log(u.getId(), "ACCOUNT_LOCKED", httpRequest,
                            Map.of("reason", "Too many failed attempts", "count", attempts));
                }
            }
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE, captchaRequired);
        }

        assertAccountActive(u);

        // Reset failed attempts on success
        users.resetFailedAttempts(u.getEmail());

        boolean rememberMe = Boolean.TRUE.equals(req.rememberMe());
        if (twoFactor.isEnabled(u.getId())) {
            String challenge = twoFactor.issueChallengeToken(u.getId(), rememberMe);
            return new LoginFlowResponse(true, challenge, null, null, null);
        }

        audit.log(u.getId(), "LOGIN", httpRequest);
        AuthResponse auth = createAuthResponse(u, httpRequest, rememberMe);
        return toLoginFlow(auth);
    }

    @Transactional(timeout = 10)
    public AuthResponse verifyTwoFactorLogin(com.careerops.dto.SecurityDtos.TwoFactorVerifyRequest req,
                                             @Nullable HttpServletRequest httpRequest) {
        TwoFactorService.TwoFactorLoginVerification verified =
                twoFactor.verifyLoginCode(req.challengeToken(), req.code());
        UUID userId = verified.userId();
        boolean rememberMe = verified.rememberMe();
        User u = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized(GENERIC_LOGIN_FAILURE));
        assertAccountActive(u);
        audit.log(userId, "LOGIN", httpRequest);
        return createAuthResponse(u, httpRequest, rememberMe);
    }

    private static LoginFlowResponse toLoginFlow(AuthResponse auth) {
        return new LoginFlowResponse(false, null, auth.token(), auth.refreshToken(), auth.user());
    }

    /**
     * Issues a fresh access + refresh token pair for a user.
     * Used by login, refresh, and rotation after password change.
     */
    @Transactional(timeout = 10)
    public AuthResponse createAuthResponse(User u, @Nullable HttpServletRequest request, boolean rememberMe) {
        boolean onboarded = profiles.findByUserId(u.getId())
                .map(OnboardingStatusResolver::isOnboarded).orElse(false);

        String rawRefresh = issueRefreshToken(u, request, rememberMe);
        return new AuthResponse(jwt.issue(u.getId().toString(), u.getEmail()), rawRefresh, toDto(u, onboarded));
    }

    @Transactional(timeout = 10)
    public AuthResponse createAuthResponse(User u, @Nullable HttpServletRequest request) {
        return createAuthResponse(u, request, false);
    }

    /** Overload kept for backward-compat or non-request contexts. */
    @Transactional(timeout = 10)
    public AuthResponse createAuthResponse(User u) {
        return createAuthResponse(u, null, false);
    }

    /**
     * Overload kept for backward-compat where HttpServletRequest is not available.
     */
    @Transactional(timeout = 10)
    public LoginFlowResponse login(LoginRequest req) {
        return login(req, null);
    }

    // ─── Refresh ───────────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public AuthResponse refresh(String rawRefreshToken, @Nullable HttpServletRequest httpRequest) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank())
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_REFRESH_FAILURE);

        String hashed = sha256(rawRefreshToken);

        Optional<RefreshToken> active = refreshTokens.findByTokenHashAndConsumedAtIsNull(hashed);
        if (active.isEmpty()) {
            refreshTokens.findByTokenHashAndConsumedAtIsNotNull(hashed).ifPresent(consumed -> {
                UUID familyId = consumed.getTokenFamilyId();
                if (familyId != null) {
                    refreshTokens.deleteByTokenFamilyId(familyId);
                    log.warn("Refresh token reuse detected for user={} family={}", consumed.getUserId(), familyId);
                }
            });
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_REFRESH_FAILURE);
        }

        RefreshToken rt = active.get();

        if (Instant.now().isAfter(rt.getExpiresAt())) {
            refreshTokens.delete(rt);
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_REFRESH_FAILURE);
        }

        User u = users.findById(rt.getUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_REFRESH_FAILURE));
        assertAccountActive(u, GENERIC_REFRESH_FAILURE);

        if (rt.getBindingHash() != null && httpRequest != null) {
            String expected = computeRefreshBindingHash(httpRequest);
            if (!MessageDigest.isEqual(
                    rt.getBindingHash().getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    expected.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
                UUID familyId = rt.getTokenFamilyId();
                if (familyId != null) {
                    refreshTokens.deleteByTokenFamilyId(familyId);
                }
                log.warn("Refresh token binding mismatch for user={} family={}", rt.getUserId(), familyId);
                throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_REFRESH_FAILURE);
            }
        }

        rt.setConsumedAt(Instant.now());
        refreshTokens.save(rt);

        audit.log(u.getId(), "TOKEN_REFRESH", httpRequest);

        boolean rememberMe = rt.isRememberMe();
        String newRawRefresh = issueRefreshToken(u, httpRequest, rememberMe, rt.getTokenFamilyId());
        String newAccessToken = jwt.issue(u.getId().toString(), u.getEmail());

        boolean onboarded = profiles.findByUserId(u.getId())
                .map(OnboardingStatusResolver::isOnboarded).orElse(false);

        return new AuthResponse(newAccessToken, newRawRefresh, toDto(u, onboarded));
    }

    // ─── Logout ────────────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public void logout(UUID userId,
                       @Nullable String rawRefreshToken,
                       @Nullable String accessToken,
                       boolean logoutAll,
                       @Nullable HttpServletRequest httpRequest) {
        if (accessToken != null && !accessToken.isBlank()) {
            jwt.revokeToken(accessToken);
        }
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            refreshTokens.deleteByTokenHash(sha256(rawRefreshToken));
        } else if (logoutAll) {
            refreshTokens.deleteByUserId(userId);
        }
        audit.log(userId, "LOGOUT", httpRequest);
    }

    /**
     * Clears ALL stored refresh tokens for a user (3.008).
     */
    @Transactional(timeout = 10)
    public void revokeAllTokensForUser(UUID userId) {
        refreshTokens.deleteByUserId(userId);
        log.info("revokeAllTokensForUser: refresh tokens cleared for user {}", userId);
    }

    // ─── Forgot / Reset ────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public void forgot(ForgotRequest req) {
        String lookupEmail = normalizeEmail(req.email());
        User u = users.findByEmail(lookupEmail).orElse(null);
        if (u == null)
            return;

        // 3.004 — Security: Invalidate any existing unused reset tokens for this user
        resets.invalidateAllForUserId(u.getId());

        // 3.004 — Security: Cap to 5 resets per user per 24h to prevent spam
        long dailyCount = resets.countByUserIdAndCreatedAtAfter(u.getId(),
                Instant.now().minus(24, java.time.temporal.ChronoUnit.HOURS));
        if (dailyCount >= 5) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Daily limit of 5 password reset requests exceeded. Please try again tomorrow.");
        }

        // 2.044 — Security: Rate limit OTP requests to prevent spam (max 1 per 60s per user)
        Optional<PasswordReset> last = resets.findFirstByUserIdOrderByCreatedAtDesc(u.getId());
        if (last.isPresent() && last.get().getCreatedAt().isAfter(Instant.now().minus(1, ChronoUnit.MINUTES))) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait 60 seconds before requesting another OTP");
        }

        String otp = generateEightDigitOtp();
        String firstName = u.getName() != null && !u.getName().isBlank()
                ? u.getName().split("\\s+")[0]
                : null;
        PasswordReset pr = PasswordReset.builder()
                .userId(u.getId())
                .email(lookupEmail)
                .otpHash(otpHashService.hash(otp))
                .expiresAt(Instant.now().plus(15, ChronoUnit.MINUTES))
                .used(false)
                .build();
        resets.save(pr);
        email.sendOtp(lookupEmail, otp, firstName);
    }

    private String generateEightDigitOtp() {
        java.security.SecureRandom rnd = new java.security.SecureRandom();
        int code = 10_000_000 + rnd.nextInt(90_000_000);
        return String.format("%08d", code);
    }

    @Transactional(timeout = 10)
    public void verifyOtp(VerifyOtpRequest req) {
        checkPwnedPassword(req.newPassword());
        String lookupEmail = normalizeEmail(req.email());
        User u = users.findByEmail(lookupEmail).orElse(null);
        if (u == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_RESET_CODE_FAILURE);
        }

        PasswordReset pr = resets
                .findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(u.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, GENERIC_RESET_CODE_FAILURE));

        if (Instant.now().isAfter(pr.getExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_RESET_CODE_FAILURE);
        }

        // 3.005 — Brute-force protection: cap attempts per OTP
        if (pr.getAttempts() >= MAX_RESET_OTP_ATTEMPTS) {
            pr.setUsed(true);
            resets.saveAndFlush(pr);
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_RESET_CODE_FAILURE);
        }

        if (!otpHashService.matches(req.otp(), pr.getOtpHash())) {
            resets.incrementAttempts(pr.getId());
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_RESET_CODE_FAILURE);
        }

        if (u.getPasswordHash() != null
                && encoder.matches(req.newPassword(), u.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_RESET_PASSWORD_FAILURE);
        }

        u.setPasswordHash(encoder.encode(req.newPassword()));

        refreshTokens.deleteByUserId(u.getId());
        users.save(u);
        audit.log(u.getId(), "PASSWORD_RESET", Map.of());

        pr.setUsed(true);

        try {
            resets.saveAndFlush(pr);
        } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
            // 3.005 — Handle concurrent OTP verification attempts
            throw new ApiException(HttpStatus.CONFLICT,
                    "This reset request was already processed or is being handled by another session.");
        }

        if (req.accessToken() != null && !req.accessToken().isBlank()) {
            jwt.revokeToken(req.accessToken());
        }
    }

    /** H-13/H-14 — reCAPTCHA required when secret configured (prod/staging). */
    public void requireRecaptchaWhenConfigured(String captchaToken) {
        if (!captcha.isConfigured()) {
            return;
        }
        if (captchaToken == null || captchaToken.isBlank() || !captcha.verify(captchaToken)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Security verification failed. Please try again.");
        }
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    private String issueRefreshToken(User u, @Nullable HttpServletRequest request, boolean rememberMe) {
        return issueRefreshToken(u, request, rememberMe, UUID.randomUUID());
    }

    private String issueRefreshToken(User u,
                                     @Nullable HttpServletRequest request,
                                     boolean rememberMe,
                                     UUID tokenFamilyId) {
        pruneExcessRefreshTokens(u.getId());

        byte[] bytes = new byte[48];
        new SecureRandom().nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hashed = sha256(raw);

        String deviceInfo = request != null ? request.getHeader("User-Agent") : "unknown";
        long days = rememberMe ? refreshRememberDays : refreshSessionDays;

        RefreshToken rt = RefreshToken.builder()
                .userId(u.getId())
                .tokenHash(hashed)
                .tokenFamilyId(tokenFamilyId)
                .rememberMe(rememberMe)
                .bindingHash(request != null ? computeRefreshBindingHash(request) : null)
                .expiresAt(Instant.now().plus(days, ChronoUnit.DAYS))
                .deviceInfo(deviceInfo)
                .ipAddress(request != null ? resolveClientIp(request) : null)
                .build();
        refreshTokens.save(rt);
        return raw;
    }

    private void pruneExcessRefreshTokens(UUID userId) {
        long count = refreshTokens.countByUserId(userId);
        if (count < MAX_REFRESH_TOKENS_PER_USER) {
            return;
        }
        var tokens = refreshTokens.findByUserIdOrderByLastUsedAtDesc(userId);
        for (int i = MAX_REFRESH_TOKENS_PER_USER - 1; i < tokens.size(); i++) {
            refreshTokens.delete(tokens.get(i));
        }
    }

    private String computeRefreshBindingHash(HttpServletRequest request) {
        String userAgent = request.getHeader("User-Agent");
        String ip = resolveClientIp(request);
        String subnet = ip.contains(".") ? ip.replaceAll("\\.\\d+$", ".0") : ip;
        return sha256((userAgent == null ? "unknown" : userAgent) + "|" + subnet);
    }

    private static String resolveClientIp(HttpServletRequest request) {
        return TrustedProxyIpResolver.resolveClientIp(request);
    }

    private void assertAccountNotLockedForLogin(User u) {
        if (u.getLockedUntil() != null && Instant.now().isBefore(u.getLockedUntil())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, GENERIC_LOGIN_FAILURE);
        }
    }

    private void assertAccountActive(User u) {
        assertAccountActive(u, GENERIC_LOGIN_FAILURE);
    }

    private void assertAccountActive(User u, String failureMessage) {
        if (u.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, failureMessage);
        }
    }

    /** Used by AccountController change-password — same policy as signup. */
    public void validateAccountPasswordChange(String newPassword) {
        checkPwnedPassword(newPassword, null, false);
    }

    private UserDto toDto(User u, boolean onboarded) {
        // Pass 6 #6.005: expose role so the frontend AdminRoute guard works.
        // Defensive fallback: if a row pre-dates the role enum migration the
        // entity defaults to USER; we mirror that here for the DTO.
        String role = u.getRole() != null ? u.getRole().name() : User.Role.USER.name();
        boolean passwordLoginEnabled = u.getPasswordHash() != null && !u.getPasswordHash().isBlank();
        return new UserDto(
                u.getId(),
                u.getName(),
                u.getUsername(),
                u.getEmail(),
                role,
                onboarded,
                u.getCreatedAt(),
                passwordLoginEnabled);
    }

    // ─── /auth/me ──────────────────────────────────────────────────────────────

    /**
     * Pass 6 #6.045 — the frontend AuthContext calls GET /auth/me on every
     * mount to confirm the session is still valid AND pick up role / onboarded
     * changes pushed from the server. Returns 401 if the user has been deleted
     * or soft-deleted between sessions.
     */
    @Transactional(timeout = 10, readOnly = true)
    public UserDto me(UUID userId) {
        User u = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Session expired"));

        assertAccountActive(u);

        boolean onboarded = profiles.findByUserId(u.getId())
                .map(OnboardingStatusResolver::isOnboarded)
                .orElse(false);

        return toDto(u, onboarded);
    }

    /** Pre-signup breach check (HIBP); E2E test email bypasses when {@code resend.dev-mode} is on. */
    public void validateOnboardingPassword(String password, String email) {
        checkPwnedPassword(password, normalizeEmail(email), true);
    }

    private void checkPwnedPassword(String password) {
        checkPwnedPassword(password, null, false);
    }

    private void checkPwnedPassword(String password, @Nullable String email, boolean allowE2eBypass) {
        if (password == null || password.isBlank()) {
            return;
        }
        if (allowE2eBypass && email != null && isDevE2eEmail(email)) {
            return;
        }
        try {
            java.security.MessageDigest sha1 = java.security.MessageDigest.getInstance("SHA-1");
            byte[] bytes = sha1.digest(password.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02X", b));
            }
            String sha1Hex = sb.toString();
            String prefix = sha1Hex.substring(0, 5);
            String suffix = sha1Hex.substring(5);

            java.net.URI uri = java.net.URI.create("https://api.pwnedpasswords.com/range/" + prefix);
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(uri)
                    .header("User-Agent", "CareerOps-SecHardening")
                    .timeout(java.time.Duration.ofSeconds(3))
                    .GET()
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                String body = response.body();
                java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.StringReader(body));
                String line;
                while ((line = reader.readLine()) != null) {
                    String[] parts = line.split(":");
                    if (parts.length > 0 && parts[0].equalsIgnoreCase(suffix)) {
                        int count = Integer.parseInt(parts[1].trim());
                        if (count > 0) {
                            throw new ApiException(HttpStatus.BAD_REQUEST, GENERIC_WEAK_PASSWORD);
                        }
                    }
                }
            }
        } catch (ApiException ae) {
            throw ae;
        } catch (Exception e) {
            if (environment.acceptsProfiles(Profiles.of("prod", "staging"))) {
                log.error("Pwned Password API check failed (fail-closed): {}", e.getMessage());
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Password security check is temporarily unavailable. Please try again shortly.");
            }
            log.warn("Pwned Password API check failed (failing-open): {}", e.getMessage());
        }
    }

    private void provisionTrialSafely(User user) {
        try {
            trialProvisioningService.provisionForNewUser(user);
        } catch (Exception ex) {
            log.warn("Trial provisioning failed for user {}: {}", user.getId(), ex.getMessage());
        }
    }

    private boolean isDevE2eEmail(String email) {
        if (!resendDevMode || email == null || email.isBlank()) {
            return false;
        }
        String norm = normalizeEmail(email);
        String configured = e2eTestEmail == null ? "" : e2eTestEmail.trim().toLowerCase(Locale.ROOT);
        return norm.endsWith("@careerops.test")
                || (!configured.isEmpty() && norm.equals(configured));
    }

    static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] b = md.digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
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
}
