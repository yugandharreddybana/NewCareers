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
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
            OnboardingEmailVerificationService onboardingVerification) {
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
    }

    // ─── Signup ────────────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public AuthResponse signup(SignupRequest req, @Nullable HttpServletRequest request) {
        if (req.consents() == null || !Boolean.TRUE.equals(req.consents().termsAccepted())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You must accept the Terms of Service");
        }
        String email = normalizeEmail(req.email());
        checkPwnedPassword(req.password(), email, true);
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
                    .passwordHash(encoder.encode(req.password()))
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

            audit.log(u.getId(), "SIGNUP", request, Map.of("email", u.getEmail()));

            String rawRefresh = issueRefreshToken(u, null, false);
            return new AuthResponse(jwt.issue(u.getId().toString(), u.getEmail()), rawRefresh, toDto(u, false));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 3.003 — Handle race condition where another request created the user between
            // exists check and save
            throw new ApiException(HttpStatus.CONFLICT, "Email or username already in use");
        }
    }

    // ─── Google Sign-In ────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public AuthResponse authenticateWithGoogle(GoogleAuthRequest req, @Nullable HttpServletRequest httpRequest) {
        GoogleOAuthService.GoogleIdentity identity = googleOAuth.verifyIdToken(req.idToken());

        Optional<User> byGoogle = users.findByGoogleSub(identity.sub());
        User u;
        if (byGoogle.isPresent()) {
            u = byGoogle.get();
        } else {
            Optional<User> byEmail = users.findByEmail(identity.email());
            if (byEmail.isPresent()) {
                u = byEmail.get();
                if (u.getGoogleSub() != null && !u.getGoogleSub().equals(identity.sub())) {
                    throw new ApiException(HttpStatus.CONFLICT,
                            "This email is linked to a different Google account");
                }
                u.setGoogleSub(identity.sub());
                u.setAuthProvider(User.AuthProvider.GOOGLE);
                if (u.getEmailVerifiedAt() == null) {
                    u.setEmailVerifiedAt(Instant.now());
                }
                users.save(u);
            } else {
                u = createGoogleUser(identity, httpRequest, req.consents());
            }
        }

        users.resetFailedAttempts(u.getEmail());
        u.setLastLoginAt(Instant.now());
        users.save(u);

        audit.log(u.getId(), "GOOGLE_LOGIN", httpRequest, Map.of("email", u.getEmail()));
        return createAuthResponse(u, httpRequest);
    }

    private User createGoogleUser(
            GoogleOAuthService.GoogleIdentity identity,
            @Nullable HttpServletRequest httpRequest,
            @Nullable SignupConsentsRequest consents) {
        if (consents == null || !Boolean.TRUE.equals(consents.termsAccepted())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You must accept the Terms of Service");
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

            audit.log(u.getId(), "GOOGLE_SIGNUP", httpRequest, Map.of("email", u.getEmail()));
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
    public AuthResponse login(LoginRequest req, @Nullable HttpServletRequest httpRequest) {
        String lookupEmail = normalizeEmail(req.email());
        User u = users.findByEmail(lookupEmail).orElse(null);

        // 3.002 — Brute-force protection: check lockout BEFORE password check
        if (u != null && u.getLockedUntil() != null && Instant.now().isBefore(u.getLockedUntil())) {
            encoder.matches(req.password(), DUMMY_HASH);
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Account is temporarily locked due to excessive failed attempts. Please try again in 15 minutes.");
        }

        // Jumbled word CAPTCHA — required in prod/staging; skipped in local dev
        if (loginWordCaptchaRequired) {
            if (req.captchaToken() == null || req.captchaToken().isBlank()) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Captcha verification required", true);
            }
            if (!wordCaptcha.verifyToken(req.captchaToken())) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid captcha. Please try again.", true);
            }
        }

        if (u != null && (u.getPasswordHash() == null || u.getPasswordHash().isBlank())) {
            encoder.matches(req.password(), DUMMY_HASH);
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "This account uses Google Sign-In. Please continue with Google.");
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
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials", captchaRequired);
        }

        // Reset failed attempts on success
        users.resetFailedAttempts(u.getEmail());

        audit.log(u.getId(), "LOGIN", httpRequest);
        return createAuthResponse(u, httpRequest, Boolean.TRUE.equals(req.rememberMe()));
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
    public AuthResponse login(LoginRequest req) {
        return login(req, null);
    }

    // ─── Refresh ───────────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public AuthResponse refresh(String rawRefreshToken, @Nullable HttpServletRequest httpRequest) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank())
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token required");

        String hashed = sha256(rawRefreshToken);

        RefreshToken rt = refreshTokens.findByTokenHash(hashed)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token"));

        if (Instant.now().isAfter(rt.getExpiresAt())) {
            refreshTokens.delete(rt);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        User u = users.findById(rt.getUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found"));

        // Rotate token: delete old one, issue new one (Task 3.008)
        refreshTokens.delete(rt);

        audit.log(u.getId(), "TOKEN_REFRESH", httpRequest);

        boolean rememberMe = rt.getExpiresAt().isAfter(
                Instant.now().plus(refreshSessionDays, ChronoUnit.DAYS));
        String newRawRefresh = issueRefreshToken(u, httpRequest, rememberMe);
        String newAccessToken = jwt.issue(u.getId().toString(), u.getEmail());

        boolean onboarded = profiles.findByUserId(u.getId())
                .map(OnboardingStatusResolver::isOnboarded).orElse(false);

        return new AuthResponse(newAccessToken, newRawRefresh, toDto(u, onboarded));
    }

    // ─── Logout ────────────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    public void logout(UUID userId, @Nullable String rawRefreshToken, @Nullable HttpServletRequest httpRequest) {
        if (rawRefreshToken != null) {
            refreshTokens.deleteByTokenHash(sha256(rawRefreshToken));
        } else {
            // Fallback: if no token provided, clear ALL for this user (3.008)
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

        String otp = generateSixDigitOtp();
        String firstName = u.getName() != null && !u.getName().isBlank()
                ? u.getName().split("\\s+")[0]
                : null;
        PasswordReset pr = PasswordReset.builder()
                .userId(u.getId())
                .email(lookupEmail)
                .otpHash(sha256(otp))
                .expiresAt(Instant.now().plus(15, ChronoUnit.MINUTES))
                .used(false)
                .build();
        resets.save(pr);
        email.sendOtp(lookupEmail, otp, firstName);
    }

    private String generateSixDigitOtp() {
        java.security.SecureRandom rnd = new java.security.SecureRandom();
        int code = 100_000 + rnd.nextInt(900_000);
        return String.format("%06d", code);
    }

    @Transactional(timeout = 10)
    public void verifyOtp(VerifyOtpRequest req) {
        checkPwnedPassword(req.newPassword());
        String lookupEmail = normalizeEmail(req.email());
        User u = users.findByEmail(lookupEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));

        PasswordReset pr = resets
                .findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(u.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "No reset request found"));

        if (Instant.now().isAfter(pr.getExpiresAt()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP expired");

        // 3.005 — Brute-force protection: cap attempts per OTP
        if (pr.getAttempts() >= 5) {
            pr.setUsed(true); // Invalidate after too many failures
            resets.saveAndFlush(pr);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Too many failed attempts. This OTP is now invalid.");
        }

        // 2.040 — Security: Use constant-time comparison to prevent timing attacks
        String providedHash = sha256(req.otp());
        if (!MessageDigest.isEqual(pr.getOtpHash().getBytes(), providedHash.getBytes())) {
            resets.incrementAttempts(pr.getId());
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid OTP");
        }

        if (u.getPasswordHash() != null
                && encoder.matches(req.newPassword(), u.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "New password cannot be the same as your current password");
        }

        u.setPasswordHash(encoder.encode(req.newPassword()));

        // 3.007 — Security: Invalidate all existing sessions after password reset
        refreshTokens.deleteByUserId(u.getId());
        users.save(u);

        pr.setUsed(true);

        try {
            resets.saveAndFlush(pr);
        } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
            // 3.005 — Handle concurrent OTP verification attempts
            throw new ApiException(HttpStatus.CONFLICT,
                    "This reset request was already processed or is being handled by another session.");
        }
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    private String issueRefreshToken(User u, @Nullable HttpServletRequest request, boolean rememberMe) {
        byte[] bytes = new byte[48];
        new SecureRandom().nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hashed = sha256(raw);

        String deviceInfo = request != null ? request.getHeader("User-Agent") : "unknown";
        long days = rememberMe ? refreshRememberDays : refreshSessionDays;

        RefreshToken rt = RefreshToken.builder()
                .userId(u.getId())
                .tokenHash(hashed)
                .expiresAt(Instant.now().plus(days, ChronoUnit.DAYS))
                .deviceInfo(deviceInfo)
                .build();
        refreshTokens.save(rt);
        return raw;
    }

    private UserDto toDto(User u, boolean onboarded) {
        // Pass 6 #6.005: expose role so the frontend AdminRoute guard works.
        // Defensive fallback: if a row pre-dates the role enum migration the
        // entity defaults to USER; we mirror that here for the DTO.
        String role = u.getRole() != null ? u.getRole().name() : User.Role.USER.name();
        return new UserDto(
                u.getId(),
                u.getName(),
                u.getUsername(),
                u.getEmail(),
                role,
                onboarded,
                u.getCreatedAt());
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

        if (u.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Account is no longer active");
        }

        boolean onboarded = profiles.findByUserId(u.getId())
                .map(OnboardingStatusResolver::isOnboarded)
                .orElse(false);

        return toDto(u, onboarded);
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
                            throw new ApiException(HttpStatus.BAD_REQUEST, "This password has been found in " + count + " known data breaches. Please choose a more secure password.");
                        }
                    }
                }
            }
        } catch (ApiException ae) {
            throw ae;
        } catch (Exception e) {
            log.warn("Pwned Password API check failed (failing-open): {}", e.getMessage());
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
