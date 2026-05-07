package com.careerops.controller;

import com.careerops.model.User;
import com.careerops.repository.UserRepository;
import com.careerops.service.AdminService;
import com.careerops.service.AuthService;
import com.careerops.util.AuthUtil;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Account settings endpoints (separate from ProfileController which handles
 * public-facing profile data).
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/account")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
@Slf4j
public class AccountController {

    private final UserRepository       userRepository;
    private final PasswordEncoder      passwordEncoder;
    private final AuthService          authService;
    private final AdminService          adminService;

    private static final ConcurrentHashMap<UUID, Integer> deleteAttempts = new ConcurrentHashMap<>();

    // ── DTOs ─────────────────────────────────────────────────────────────

    record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 8, max = 128) String newPassword
    ) {}

    record DeleteAccountRequest(
        @NotBlank String password
    ) {}

    // ── Change password ───────────────────────────────────────────────────

    /**
     * PATCH /api/account/password
     * Verifies the current password before setting the new one.
     * Returns 400 if the current password is wrong.
     * Returns 204 on success.
     */
    @PatchMapping("/password")
    public com.careerops.dto.AuthDtos.AuthResponse changePassword(
            @RequestBody @Valid ChangePasswordRequest req
    ) {
        UUID userId = AuthUtil.currentUserId();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw com.careerops.exception.ApiException.badRequest("Incorrect current password");
        }

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);

        // Invalidate other sessions, but provide fresh tokens for the current one
        authService.revokeAllTokensForUser(userId);
        var authResponse = authService.createAuthResponse(user);

        return authResponse;
    }

    // ── Delete account ──────────────────────────────────────────────────────

    /**
     * DELETE /api/account
     * Requires the user to confirm their password before deletion.
     * Cascades via DB foreign keys: user_jobs, skill_runs, cv_documents,
     * notifications, user_profiles, refresh_tokens all deleted automatically.
     * Returns 204 on success.
     */
    @DeleteMapping
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void deleteAccount(
            @RequestBody @Valid DeleteAccountRequest req
    ) {
        UUID userId = AuthUtil.currentUserId();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            log.warn("Failed delete-account attempt for userId={} at {}", userId, java.time.Instant.now());
            int attempts = deleteAttempts.compute(userId, (k, v) -> v == null ? 1 : v + 1);
            if (attempts >= 5) {
                user.setDeletedAt(java.time.Instant.now()); // Lock/Soft delete
                userRepository.save(user);
                throw com.careerops.exception.ApiException.badRequest("Account locked due to excessive failed attempts");
            }
            throw com.careerops.exception.ApiException.badRequest("Incorrect password");
        }

        // Reset on successful confirmation
        deleteAttempts.remove(userId);

        // Invalidate all refresh tokens first (belt + suspenders on top of cascade)
        authService.revokeAllTokensForUser(userId);

        adminService.softDeleteUser(userId);
    }
}
