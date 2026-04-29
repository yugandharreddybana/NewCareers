package com.careerops.dto;

import java.time.Instant;
import java.util.UUID;

public class JobDtos {
    public record JobCardResponse(
        UUID userJobId, UUID jobId, String title, String company, String location,
        Integer salaryMin, Integer salaryMax, String currency, Boolean sponsorship,
        Integer matchPercent, String verdict, Instant postedAt, Instant deliveredAt,
        String kanbanColumn, String status, String sourceUrl
    ) {}

    public record JobDetailResponse(
        UUID userJobId, UUID jobId, String title, String company, String location,
        Integer salaryMin, Integer salaryMax, String currency, Boolean sponsorship,
        String description, String sourceUrl, String sourceName, String sector,
        Instant postedAt, Integer matchPercent, Integer aiScore,
        String[] matchedSkills, String[] unmatchedSkills, String[] cvImprovementTips,
        String humanSummary, String verdict, String kanbanColumn, String status
    ) {}

    public record FetchSummary(int delivered, int dailyCount, int dailyLimit, int remaining) {}

    public record KanbanUpdateRequest(String kanbanColumn, String status) {}
}
