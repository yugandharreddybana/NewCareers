package com.careerops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
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
        @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$") String password
    ) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password,
        String captchaToken
    ) {}

    public record ForgotRequest(
        @NotBlank @Email String email
    ) {}

    public record VerifyOtpRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(max = 20) String otp,
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
}
