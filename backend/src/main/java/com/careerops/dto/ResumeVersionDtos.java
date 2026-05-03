package com.careerops.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class ResumeVersionDtos {

    public record CreateResumeVersionRequest(
        String name,
        String source,
        String[] roleTags,
        boolean isActive,
        boolean isFavorite,
        String outcomeAssociation,
        String bestForRoleType,
        String notes
    ) {}

    public record UpdateResumeVersionRequest(
        String name,
        String[] roleTags,
        Boolean isActive,
        Boolean isFavorite,
        String outcomeAssociation,
        String bestForRoleType,
        String notes
    ) {}

    public record ResumeVersionResponse(
        UUID id,
        String name,
        int versionNumber,
        String source,
        String[] roleTags,
        boolean isActive,
        boolean isFavorite,
        String outcomeAssociation,
        int interviewCount,
        int applicationCount,
        int offerCount,
        String bestForRoleType,
        String notes,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record ResumeVersionListResponse(List<ResumeVersionResponse> versions, int total) {}

    public record RecordOutcomeRequest(String outcome) {}

    public record CompareResponse(
        ResumeVersionResponse left,
        ResumeVersionResponse right,
        String recommendation
    ) {}

    public record RecommendResponse(
        ResumeVersionResponse recommended,
        String reason
    ) {}
}
