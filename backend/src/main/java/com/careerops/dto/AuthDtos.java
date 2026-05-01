package com.careerops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Auth-related DTOs for register, login, forgot-password, OTP verify, and refresh.
 */
public class AuthDtos {

    public record SignupRequest(
        @NotBlank String name,
        @NotBlank String username,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8) String password
    ) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    public record ForgotRequest(
        @NotBlank @Email String email
    ) {}

    public record VerifyOtpRequest(
        @NotBlank @Email String email,
        @NotBlank String otp,
        @NotBlank @Size(min = 8) String newPassword
    ) {}

    /** Task 118 — body for POST /auth/refresh */
    public record RefreshRequest(
        @NotBlank String refreshToken
    ) {}

    public record UserDto(
        String id,
        String name,
        String username,
        String email,
        boolean onboarded
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
