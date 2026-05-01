package com.careerops.service;

import com.careerops.dto.AuthDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.PasswordReset;
import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.repository.PasswordResetRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
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
import java.util.Map;
import java.util.UUID;

/**
 * Task 117 — AuthService updated to issue refresh tokens on login (7-day expiry,
 * stored hashed), rotate on every use (invalidate old, issue new), and blacklist on logout.
 * Access token expiry remains at 15 minutes (controlled by jwt.expiry.ms in application.properties).
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    /** Refresh token validity: 7 days. */
    private static final long REFRESH_EXPIRY_DAYS = 7;

    private final UserRepository          users;
    private final UserProfileRepository   profiles;
    private final PasswordResetRepository resets;
    private final PasswordEncoder         encoder;
    private final JwtService              jwt;
    private final ResendEmailService      email;
    private final ReferralService         referralService;
    private final AuditLogService         audit;

    public AuthService(UserRepository users,
                       UserProfileRepository profiles,
                       PasswordResetRepository resets,
                       PasswordEncoder encoder,
                       JwtService jwt,
                       ResendEmailService email,
                       ReferralService referralService,
                       AuditLogService audit) {
        this.users           = users;
        this.profiles        = profiles;
        this.resets          = resets;
        this.encoder         = encoder;
        this.jwt             = jwt;
        this.email           = email;
        this.referralService = referralService;
        this.audit           = audit;
    }

    // ─── Signup ────────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        if (users.existsByEmail(req.email()))
            throw new ApiException(HttpStatus.CONFLICT, "Email already in use");
        if (users.existsByUsername(req.username()))
            throw new ApiException(HttpStatus.CONFLICT, "Username taken");

        User u = users.save(User.builder()
            .name(req.name())
            .username(req.username())
            .email(req.email())
            .passwordHash(encoder.encode(req.password()))
            .build());

        profiles.save(UserProfile.builder()
            .userId(u.getId())
            .location("Ireland")
            .freshnessHours(96)
            .minMatchPercent(60)
            .sponsorshipRequired(false)
            .onboarded(false)
            .build());

        try {
            referralService.onRefereeSignup(u.getEmail(), u.getName());
        } catch (Exception e) {
            log.warn("onRefereeSignup non-fatal during signup for {}: {}", u.getEmail(), e.getMessage());
        }

        audit.log(u.getId(), "SIGNUP", Map.of("email", u.getEmail()));

        String rawRefresh = issueRefreshToken(u);
        return new AuthResponse(jwt.issue(u.getId().toString(), u.getEmail()), rawRefresh, toDto(u, false));
    }

    // ─── Login ─────────────────────────────────────────────────────────────────

    @Transactional
    public AuthResponse login(LoginRequest req, HttpServletRequest httpRequest) {
        User u = users.findByEmail(req.email())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        if (!encoder.matches(req.password(), u.getPasswordHash()))
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials");

        boolean onboarded = profiles.findByUserId(u.getId())
            .map(UserProfile::getOnboarded).orElse(false);

        audit.log(u.getId(), "LOGIN", httpRequest);

        String rawRefresh = issueRefreshToken(u);
        return new AuthResponse(jwt.issue(u.getId().toString(), u.getEmail()), rawRefresh, toDto(u, onboarded));
    }

    /** Overload kept for backward-compat where HttpServletRequest is not available. */
    @Transactional
    public AuthResponse login(LoginRequest req) {
        return login(req, null);
    }

    // ─── Refresh ───────────────────────────────────────────────────────────────

    /**
     * Task 118 — Validate a refresh token, rotate it (invalidate old, issue new),
     * and return a new access token + new refresh token.
     */
    @Transactional
    public AuthResponse refresh(String rawRefreshToken, HttpServletRequest httpRequest) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank())
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token required");

        String hashed = sha256(rawRefreshToken);

        User u = users.findByRefreshToken(hashed)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token"));

        if (u.getRefreshTokenExpiresAt() == null || Instant.now().isAfter(u.getRefreshTokenExpiresAt())) {
            // Expire token on the record so it can't be reused
            u.setRefreshToken(null);
            u.setRefreshTokenExpiresAt(null);
            users.save(u);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        boolean onboarded = profiles.findByUserId(u.getId())
            .map(UserProfile::getOnboarded).orElse(false);

        audit.log(u.getId(), "TOKEN_REFRESH", httpRequest);

        // Rotate: invalidate old, issue new
        String newRawRefresh = issueRefreshToken(u);
        String newAccessToken = jwt.issue(u.getId().toString(), u.getEmail());

        return new AuthResponse(newAccessToken, newRawRefresh, toDto(u, onboarded));
    }

    // ─── Logout ────────────────────────────────────────────────────────────────

    /** Blacklist the refresh token by clearing it from the user record. */
    @Transactional
    public void logout(UUID userId, HttpServletRequest httpRequest) {
        users.findById(userId).ifPresent(u -> {
            u.setRefreshToken(null);
            u.setRefreshTokenExpiresAt(null);
            users.save(u);
            audit.log(userId, "LOGOUT", httpRequest);
        });
    }

    // ─── Forgot / Reset ────────────────────────────────────────────────────────

    @Transactional
    public void forgot(ForgotRequest req) {
        if (users.findByEmail(req.email()).isEmpty()) return;
        String otp = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        PasswordReset pr = PasswordReset.builder()
            .email(req.email())
            .otpHash(sha256(otp))
            .expiresAt(Instant.now().plus(15, ChronoUnit.MINUTES))
            .used(false)
            .build();
        resets.save(pr);
        email.sendOtp(req.email(), otp);
    }

    @Transactional
    public void verifyOtp(VerifyOtpRequest req) {
        PasswordReset pr = resets
            .findFirstByEmailAndUsedFalseOrderByCreatedAtDesc(req.email())
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "No reset request found"));
        if (Instant.now().isAfter(pr.getExpiresAt()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP expired");
        if (!pr.getOtpHash().equals(sha256(req.otp())))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid OTP");
        User u = users.findByEmail(req.email())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        u.setPasswordHash(encoder.encode(req.newPassword()));
        users.save(u);
        pr.setUsed(true);
        resets.save(pr);
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    /** Generate a secure random refresh token, store its hash on the user, return the raw value. */
    private String issueRefreshToken(User u) {
        byte[] bytes = new byte[48];
        new SecureRandom().nextBytes(bytes);
        String raw    = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hashed = sha256(raw);
        u.setRefreshToken(hashed);
        u.setRefreshTokenExpiresAt(Instant.now().plus(REFRESH_EXPIRY_DAYS, ChronoUnit.DAYS));
        users.save(u);
        return raw;
    }

    private UserDto toDto(User u, boolean onboarded) {
        return new UserDto(u.getId().toString(), u.getName(), u.getUsername(), u.getEmail(), onboarded);
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] b = md.digest(s.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte x : b) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
