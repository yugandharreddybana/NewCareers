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
}
