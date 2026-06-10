package com.careerops.dto;

import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import com.careerops.validation.ValidGoogleAuthConsents;

/**
 * Auth-related DTOs for register, login, forgot-password, OTP verify, and refresh.
 */
public class AuthDtos {

    public record SignupRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 100) @Pattern(regexp = "^[a-zA-Z0-9._-]{3,30}$") String username,
        @NotBlank @Email @Size(max = 254) String email,
        @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$") String password,
        @Valid @NotNull SignupConsentsRequest consents,
        @NotNull java.util.UUID emailVerificationId,
        java.util.UUID signupIntentId,
        String captchaToken
    ) {}

    public record SignupIntentRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$") String password,
        @Valid @NotNull SignupConsentsRequest consents,
        @Size(max = 100) String name,
        String captchaToken
    ) {}

    public record SignupIntentResponse(
        java.util.UUID signupIntentId,
        java.time.Instant expiresAt
    ) {}

    public record OnboardingCheckEmailRequest(
        @NotBlank @Email @Size(max = 254) String email
    ) {}

    public record OnboardingCheckEmailResponse(boolean available) {}

    public record OnboardingCheckPasswordRequest(
        @NotNull java.util.UUID signupIntentId,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 128)
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$") String password
    ) {}

    public record OnboardingCheckPasswordResponse(boolean secure) {}

    public record OnboardingSendOtpRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @Size(max = 100) String firstName,
        String captchaToken
    ) {}

    public record OnboardingResendOtpRequest(
        @NotBlank @Email @Size(max = 254) String email,
        String captchaToken
    ) {}

    public record OnboardingVerifyEmailRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "^\\d{8}$", message = "OTP must be an 8-digit code") String otp,
        String captchaToken
    ) {}

    public record OnboardingOtpSentResponse(int resendsRemaining, int retryAfterSeconds) {}

    public record OnboardingVerificationResponse(java.util.UUID verificationId) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(max = 128) String password,
        String captchaToken,
        Boolean rememberMe
    ) {}

    /** Jumbled character CAPTCHA — GET /auth/captcha/challenge (SVG only; answer never exposed). */
    public record WordCaptchaChallengeResponse(
        String challengeId,
        String imageSvg
    ) {}

    public record GoogleLinkConfirmRequest(
        @NotBlank @Size(min = 100, max = 8192) String idToken,
        @NotBlank String password,
        String captchaToken
    ) {}

    /** Body for POST /auth/google — Google Identity Services ID token (JWT). */
    @ValidGoogleAuthConsents
    public record GoogleAuthRequest(
        @NotBlank @Size(min = 100, max = 8192) String idToken,
        @Valid SignupConsentsRequest consents,
        String captchaToken
    ) {}

    public record SignupIntentExistsResponse(boolean exists, boolean active) {}

    public record ForgotRequest(
        @NotBlank @Email String email
    ) {}

    public record VerifyOtpRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "^\\d{8}$", message = "OTP must be an 8-digit code") String otp,
        @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$") String newPassword,
        String accessToken
    ) {}

    /** Task 118 — body for POST /auth/refresh */
    public record RefreshRequest(
        @NotBlank @Size(max = 256) String refreshToken
    ) {}

    public record LogoutRequest(
        String refreshToken,
        String accessToken,
        Boolean logoutAllDevices
    ) {}

    /**
     * User payload returned to the client.
     *
     * Pass 6 #6.005 — added {@code role} so the frontend AdminRoute guard
     * can correctly identify administrators. Frontend reads "USER" | "ADMIN".
     *
     * Pass 6 #6.045 / #2.046 — added {@code createdAt} so AccountSettings can
     * show "Member since …" without an extra round-trip.
     */
    public record UserDto(
        java.util.UUID id,
        String name,
        String username,
        String email,
        String role,
        boolean onboarded,
        java.time.Instant createdAt,
        boolean passwordLoginEnabled
    ) {}

    /**
     * Updated AuthResponse now includes both the short-lived access token
     * and the long-lived refresh token (7-day, sent in body — caller may
     * store in HttpOnly cookie at the middleware/BFF layer).
     */
    public record AuthResponse(
        String token,
        String refreshToken,
        UserDto user
    ) {}

    /** Login may return tokens or a 2FA challenge instead of full session. */
    public record LoginFlowResponse(
        Boolean requiresTwoFactor,
        String challengeToken,
        String token,
        String refreshToken,
        UserDto user
    ) {}

    // ── Onboarding CV parse (stateless, pre-signup) ─────────────────────

    public record OnboardingCvParseWorkEntry(
        String jobTitle,
        String companyName,
        String startDate,
        String endDate,
        boolean current,
        String description,
        String location
    ) {}

    public record OnboardingCvParseEducationEntry(
        String schoolName,
        String degree,
        String fieldOfStudy,
        String startYear,
        String endYear,
        String graduationYear,
        String location
    ) {}

    public record OnboardingCvParseProjectEntry(
        String title,
        String description,
        String url,
        String location,
        java.util.List<String> techTags
    ) {
        public OnboardingCvParseProjectEntry(String title, String description, String url, String location) {
            this(title, description, url, location, java.util.List.of());
        }
    }

    public record OnboardingCvParseResponse(
        String cvMarkdown,
        String headline,
        java.util.List<OnboardingCvParseWorkEntry> workExperience,
        java.util.List<OnboardingCvParseEducationEntry> education,
        java.util.List<OnboardingCvParseProjectEntry> projects,
        int rolesFound,
        int educationFound,
        int projectsFound,
        String linkedInUrl,
        String githubUrl,
        String websiteUrl,
        java.util.List<String> extractedTechStack,
        java.util.List<String> extractedTargetRoles,
        String parseSource,
        java.util.List<String> parseWarnings
    ) {
        public OnboardingCvParseResponse(
            String cvMarkdown,
            String headline,
            java.util.List<OnboardingCvParseWorkEntry> workExperience,
            java.util.List<OnboardingCvParseEducationEntry> education,
            java.util.List<OnboardingCvParseProjectEntry> projects,
            int rolesFound,
            int educationFound,
            int projectsFound,
            String linkedInUrl,
            String githubUrl,
            String websiteUrl
        ) {
            this(cvMarkdown, headline, workExperience, education, projects,
                rolesFound, educationFound, projectsFound,
                linkedInUrl, githubUrl, websiteUrl,
                java.util.List.of(), java.util.List.of(), "regex", java.util.List.of());
        }
    }
}
