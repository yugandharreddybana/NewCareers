package com.careerops.dto;

import java.util.List;
import java.util.Map;

public class AdminDtos {

    public record AdminStatsResponse(
        long totalUsers,
        long activeUsers,
        long jobsDeliveredToday,
        long auditEventsToday,
        List<Map<String, Object>> topAuditEvents,
        long activeFlagCount,
        String asOf
    ) {}

    public record UserSummaryResponse(
        java.util.UUID id,
        String name,
        String email,
        String username,
        String role,
        java.time.Instant createdAt,
        java.time.Instant deletedAt
    ) {}

    public record UserListResponse(
        List<UserSummaryResponse> users,
        long totalElements,
        int totalPages,
        int page,
        int size
    ) {}
}
