package com.careerops.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class OrganizationDtos {

    public record CreateOrgRequest(
        String name,
        String slug,
        String plan,
        String domain
    ) {}

    public record UpdateOrgRequest(
        String name,
        String logoUrl,
        String domain,
        Integer seatLimit
    ) {}

    public record OrgResponse(
        UUID id,
        String name,
        String slug,
        String plan,
        String logoUrl,
        String domain,
        int seatLimit,
        int memberCount,
        Instant createdAt
    ) {}

    public record OrgMemberResponse(
        UUID id,
        UUID userId,
        String role,
        String status,
        Instant joinedAt,
        String userName,
        String userEmail
    ) {}

    public record InviteRequest(
        String email,
        String role
    ) {}

    public record InvitationResponse(
        UUID id,
        String email,
        String role,
        String status,
        Instant expiresAt,
        Instant createdAt
    ) {}

    public record CreateTeamRequest(
        String name,
        String description
    ) {}

    public record TeamResponse(
        UUID id,
        String name,
        String description,
        int memberCount,
        Instant createdAt
    ) {}

    public record OrgListResponse(
        List<OrgResponse> organizations,
        int total
    ) {}
}
