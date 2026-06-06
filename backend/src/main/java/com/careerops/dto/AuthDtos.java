package com.careerops.dto;

import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

/**
 * Auth-related DTOs for register, login, forgot-password, OTP verify, and refresh.
 */
public class AuthDtos {

    public record SignupRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 100) @Pattern(regexp = "^[a-zA-Z0-9._-]{3,30}$") String username,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$") String password,
        @Valid @NotNull SignupConsentsRequest consents,
        java.util.UUID emailVerificationId
    ) {}

    public record OnboardingCheckEmailRequest(
        @NotBlank @Email @Size(max = 254) String email
    ) {}

    public record OnboardingCheckEmailResponse(boolean available) {}

    public record OnboardingSendOtpRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @Size(max = 100) String firstName
    ) {}

    public record OnboardingResendOtpRequest(
        @NotBlank @Email @Size(max = 254) String email
    ) {}

    public record OnboardingVerifyEmailRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "^\\d{6}$", message = "OTP must be a 6-digit code") String otp,
        String captchaToken
    ) {}

    public record OnboardingOtpSentResponse(int resendsRemaining, int retryAfterSeconds) {}

    public record OnboardingVerificationResponse(java.util.UUID verificationId) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password,
        String captchaToken,
        Boolean rememberMe
    ) {}

    /** Jumbled character CAPTCHA — GET /auth/captcha/challenge */
    public record WordCaptchaLetter(
        String character,
        int rotate,
        int translateY,
        String color
    ) {}

    public record WordCaptchaChallengeResponse(
        String challengeId,
        java.util.List<WordCaptchaLetter> letters
    ) {}

    /** Body for POST /auth/google — Google Identity Services ID token (JWT). */
    public record GoogleAuthRequest(
        @NotBlank @Size(min = 100, max = 8192) String idToken,
        @Valid SignupConsentsRequest consents
    ) {}

    public record ForgotRequest(
        @NotBlank @Email String email
    ) {}

    public record VerifyOtpRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "^\\d{6}$", message = "OTP must be a 6-digit code") String otp,
        @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$") String newPassword
    ) {}

    /** Task 118 — body for POST /auth/refresh */
    public record RefreshRequest(
        @NotBlank @Size(max = 256) String refreshToken
    ) {}

    public record LogoutRequest(
        String refreshToken
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
        java.time.Instant createdAt
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

    // ── Onboarding CV parse (stateless, pre-signup) ─────────────────────

    public record OnboardingCvParseWorkEntry(
        String jobTitle,
        String companyName,
        String startDate,
        String endDate,
        boolean current,
        String description
    ) {}

    public record OnboardingCvParseEducationEntry(
        String schoolName,
        String degree,
        String fieldOfStudy,
        String graduationYear
    ) {}

    public record OnboardingCvParseProjectEntry(
        String title,
        String description
    ) {}

    public record OnboardingCvParseResponse(
        String cvMarkdown,
        String headline,
        java.util.List<OnboardingCvParseWorkEntry> workExperience,
        java.util.List<OnboardingCvParseEducationEntry> education,
        java.util.List<OnboardingCvParseProjectEntry> projects,
        int rolesFound,
        int educationFound,
        int projectsFound
    ) {}
}
