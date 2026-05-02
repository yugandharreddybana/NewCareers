package com.careerops.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class WatchlistDtos {

    public record CreateWatchlistRequest(
        String name,
        String queryKeywords,
        String location,
        Integer minSalary,
        Integer maxSalary,
        boolean remoteOnly,
        boolean sponsorshipRequired,
        short minMatchScore,
        boolean alertEmail,
        boolean alertInApp
    ) {}

    public record UpdateWatchlistRequest(
        String name,
        String queryKeywords,
        String location,
        Integer minSalary,
        Integer maxSalary,
        Boolean remoteOnly,
        Boolean sponsorshipRequired,
        Short minMatchScore,
        Boolean alertEmail,
        Boolean alertInApp,
        String status
    ) {}

    public record WatchlistResponse(
        UUID id,
        String name,
        String queryKeywords,
        String location,
        Integer minSalary,
        Integer maxSalary,
        boolean remoteOnly,
        boolean sponsorshipRequired,
        short minMatchScore,
        boolean alertEmail,
        boolean alertInApp,
        String status,
        Instant lastRunAt,
        int matchedTotal,
        int clickedTotal,
        int appliedTotal,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record WatchlistListResponse(List<WatchlistResponse> watchlists, int total) {}

    public record WatchlistRunResponse(
        UUID id,
        UUID watchlistId,
        int matchedCount,
        int newCount,
        Instant runAt
    ) {}
}
