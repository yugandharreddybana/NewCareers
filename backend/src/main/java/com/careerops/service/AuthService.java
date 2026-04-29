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
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class AuthService {

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final PasswordResetRepository resets;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final ResendEmailService email;

    public AuthService(UserRepository users, UserProfileRepository profiles,
                       PasswordResetRepository resets, PasswordEncoder encoder,
                       JwtService jwt, ResendEmailService email) {
        this.users = users; this.profiles = profiles; this.resets = resets;
        this.encoder = encoder; this.jwt = jwt; this.email = email;
    }

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        if (users.existsByEmail(req.email())) throw new ApiException(HttpStatus.CONFLICT, "Email already in use");
        if (users.existsByUsername(req.username())) throw new ApiException(HttpStatus.CONFLICT, "Username taken");

        User u = users.save(User.builder()
            .name(req.name()).username(req.username()).email(req.email())
            .passwordHash(encoder.encode(req.password())).build());

        profiles.save(UserProfile.builder()
            .userId(u.getId()).location("Ireland")
            .freshnessHours(96).minMatchPercent(60)
            .sponsorshipRequired(false).onboarded(false).build());

        return new AuthResponse(jwt.issue(u.getId().toString(), u.getEmail()), toDto(u, false));
    }

    public AuthResponse login(LoginRequest req) {
        User u = users.findByEmail(req.email())
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        if (!encoder.matches(req.password(), u.getPasswordHash()))
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        boolean onboarded = profiles.findByUserId(u.getId()).map(UserProfile::getOnboarded).orElse(false);
        return new AuthResponse(jwt.issue(u.getId().toString(), u.getEmail()), toDto(u, onboarded));
    }

    @Transactional
    public void forgot(ForgotRequest req) {
        if (users.findByEmail(req.email()).isEmpty()) return; // do not leak existence
        String otp = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        PasswordReset pr = PasswordReset.builder()
            .email(req.email()).otpHash(sha256(otp))
            .expiresAt(Instant.now().plus(15, ChronoUnit.MINUTES))
            .used(false).build();
        resets.save(pr);
        email.sendOtp(req.email(), otp);
    }

    @Transactional
    public void verifyOtp(VerifyOtpRequest req) {
        PasswordReset pr = resets.findFirstByEmailAndUsedFalseOrderByCreatedAtDesc(req.email())
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
