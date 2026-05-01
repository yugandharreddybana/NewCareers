package com.careerops.controller;

import com.careerops.model.User;
import com.careerops.repository.UserRepository;
import com.careerops.service.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Account settings endpoints (separate from ProfileController which handles
 * public-facing profile data).
 *
 * PATCH /api/account/password  — change password (requires current password)
 * DELETE /api/account          — permanently delete the account
 */
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private final UserRepository       userRepository;
    private final PasswordEncoder      passwordEncoder;
    private final AuthService          authService;

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
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody @Valid ChangePasswordRequest req
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            return ResponseEntity.badRequest().build(); // 400 — wrong current password
        }

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        return ResponseEntity.noContent().build(); // 204
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
    public ResponseEntity<Void> deleteAccount(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody @Valid DeleteAccountRequest req
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            return ResponseEntity.badRequest().build(); // 400 — wrong password
        }

        // Invalidate all refresh tokens first (belt + suspenders on top of cascade)
        authService.revokeAllTokensForUser(userId);

        userRepository.delete(user);
        return ResponseEntity.noContent().build(); // 204
    }
}
