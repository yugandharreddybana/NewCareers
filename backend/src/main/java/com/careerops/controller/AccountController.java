package com.careerops.controller;

import com.careerops.exception.ApiException;
import com.careerops.model.User;
import com.careerops.repository.UserRepository;
import com.careerops.service.AuditLogService;
import com.careerops.service.AuthService;
import com.careerops.service.GdprExportService;
import com.careerops.service.GoogleOAuthService;
import com.careerops.service.UserAnonymizationService;
import com.careerops.util.AuthUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Account settings endpoints (separate from ProfileController which handles
 * public-facing profile data).
 */
@RestController
@RequestMapping("/account")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
@Slf4j
public class AccountController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final GdprExportService gdprExportService;
    private final UserAnonymizationService anonymizationService;
    private final GoogleOAuthService googleOAuth;
    private final AuditLogService audit;

    record ChangePasswordRequest(
        @jakarta.validation.constraints.NotBlank String currentPassword,
        @jakarta.validation.constraints.NotBlank
        @Size(min = 8, max = 128)
        @jakarta.validation.constraints.Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$")
        String newPassword
    ) {}

    record DeleteAccountRequest(
        String password,
        @Size(min = 100, max = 8192) String idToken
    ) {}

    @PatchMapping("/password")
    public com.careerops.dto.AuthDtos.AuthResponse changePassword(
            @RequestBody @Valid ChangePasswordRequest req,
            HttpServletRequest httpRequest
    ) {
        UUID userId = AuthUtil.currentUserId();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            throw ApiException.badRequest(
                    "This account uses Google Sign-In and has no password to change");
        }
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Incorrect current password");
        }

        authService.validateAccountPasswordChange(req.newPassword());

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);

        authService.revokeAllTokensForUser(userId);
        audit.log(userId, "PASSWORD_CHANGED", httpRequest);
        return authService.createAuthResponse(user, httpRequest);
    }

    @GetMapping(value = "/export", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> exportAccount(HttpServletRequest httpRequest) {
        UUID userId = AuthUtil.currentUserId();
        byte[] json = gdprExportService.exportUserDataJson(userId, httpRequest);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"my-data.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(json);
    }

    /**
     * DELETE /account — anonymizes PII, purges files, revokes tokens.
     * Password accounts require password confirmation; Google accounts require a fresh idToken.
     *
     * POST /account/delete — same semantics; used where HTTP clients omit DELETE bodies (axios, Playwright).
     */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(
            @RequestBody @Valid DeleteAccountRequest req,
            HttpServletRequest httpRequest
    ) {
        performAccountDeletion(req, httpRequest);
    }

    @PostMapping("/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccountPost(
            @RequestBody @Valid DeleteAccountRequest req,
            HttpServletRequest httpRequest
    ) {
        performAccountDeletion(req, httpRequest);
    }

    private void performAccountDeletion(DeleteAccountRequest req, HttpServletRequest httpRequest) {
        UUID userId = AuthUtil.currentUserId();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User not found"));

        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            verifyGoogleReauth(user, req.idToken());
        } else {
            if (req.password() == null || req.password().isBlank()) {
                throw ApiException.badRequest("Password confirmation is required");
            }
            if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
                log.warn("Failed delete-account attempt for userId={} at {}", userId, java.time.Instant.now());
                throw ApiException.badRequest("Incorrect password");
            }
        }

        anonymizationService.anonymizeAndDelete(userId, httpRequest);
    }

    private void verifyGoogleReauth(User user, String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw ApiException.badRequest("Google re-authentication is required to delete this account");
        }
        GoogleOAuthService.GoogleIdentity identity = googleOAuth.verifyIdToken(idToken);
        if (user.getGoogleSub() == null || !user.getGoogleSub().equals(identity.sub())) {
            throw ApiException.badRequest("Google account does not match the signed-in user");
        }
    }
}
