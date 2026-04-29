package com.careerops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record SignupRequest(
        @NotBlank String name,
        @NotBlank @Size(min=3,max=32) String username,
        @NotBlank @Email String email,
        @NotBlank @Size(min=8) String password
    ) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    public record AuthResponse(String token, UserDto user) {}

    public record UserDto(String id, String name, String username, String email, boolean onboarded) {}

    public record ForgotRequest(@NotBlank @Email String email) {}

    public record VerifyOtpRequest(
        @NotBlank @Email String email,
        @NotBlank String otp,
        @NotBlank @Size(min=8) String newPassword
    ) {}
}
