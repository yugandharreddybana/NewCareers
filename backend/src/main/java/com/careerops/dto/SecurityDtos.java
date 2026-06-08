package com.careerops.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class SecurityDtos {

    public record SessionResponse(
        UUID id,
        String deviceInfo,
        String ipAddress,
        String userAgent,
        Instant lastActiveAt,
        Instant expiresAt,
        boolean current,
        Instant createdAt
    ) {}

    public record AuditLogEntry(
        UUID id,
        String action,
        String resourceType,
        String resourceId,
        String ipAddress,
        String severity,
        Instant createdAt
    ) {}

    public record AuditLogResponse(
        List<AuditLogEntry> entries,
        int total
    ) {}

    public record SsoProviderResponse(
        UUID id,
        String providerType,
        String metadataUrl,
        boolean enabled
    ) {}

    public record UpdateSsoProviderRequest(
        String providerType,
        String metadataUrl,
        String clientId,
        String clientSecret,
        boolean enabled
    ) {}

    public record SecurityActivityEntry(
        UUID id,
        String title,
        String subtitle,
        String action,
        Instant createdAt
    ) {}

    public record SecurityActivityResponse(
        List<SecurityActivityEntry> entries,
        int total,
        int page,
        int size
    ) {}

    public record TwoFactorStatusResponse(
        boolean enabled,
        boolean rolloutEnabled,
        Instant enabledAt
    ) {}

    public record TwoFactorSetupResponse(
        String otpauthUri,
        String secretBase32
    ) {}

    public record TwoFactorEnableRequest(
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Pattern(regexp = "^\\d{6}$")
        String code
    ) {}

    public record TwoFactorDisableRequest(
        @jakarta.validation.constraints.NotBlank String currentPassword
    ) {}

    public record TwoFactorEnableResponse(
        List<String> backupCodes
    ) {}

    public record TwoFactorVerifyRequest(
        @jakarta.validation.constraints.NotBlank String challengeToken,
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Pattern(regexp = "^\\d{6}$")
        String code
    ) {}
}
