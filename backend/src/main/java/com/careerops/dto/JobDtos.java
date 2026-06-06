package com.careerops.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public class JobDtos {
    /**
     * Lightweight card response used in the jobs list.
     * matchedSkills + unmatchedSkills are included so the frontend
     * can render the CV Skills Gap banner without a separate detail call.
     */
    public record JobCardResponse(
        UUID userJobId, UUID jobId, String title, String company, String location,
        Integer salaryMin, Integer salaryMax, String currency, Boolean sponsorship,
        Integer matchPercent, String verdict,
        String humanSummary, String sourceName,
        Instant postedAt, Instant deliveredAt,
        String kanbanColumn, String status, String sourceUrl,
        String[] matchedSkills, String[] unmatchedSkills
    ) {
        public static JobCardResponse from(com.careerops.model.UserJob uj, com.careerops.model.Job j) {
            if (j == null) return null;
            return new JobCardResponse(
                uj.getId(), j.getId(), j.getTitle(), j.getCompany(), j.getLocation(),
                j.getSalaryMin(), j.getSalaryMax(), j.getCurrency(), j.getSponsorship(),
                uj.getMatchPercent(), uj.getVerdict(),
                uj.getHumanSummary(), j.getSourceName(),
                j.getPostedAt(), uj.getDeliveredAt(),
                uj.getKanbanColumn(), uj.getStatus(), j.getSourceUrl(),
                uj.getMatchedSkills(), uj.getUnmatchedSkills()
            );
        }
    }

    public record JobDetailResponse(
        UUID userJobId, UUID jobId, String title, String company, String location,
        Integer salaryMin, Integer salaryMax, String currency, Boolean sponsorship,
        String description, String sourceUrl, String sourceName, String sector,
        Instant postedAt, Integer matchPercent, Integer aiScore,
        String[] matchedSkills, String[] unmatchedSkills, String[] cvImprovementTips,
        String humanSummary, String verdict, String kanbanColumn, String status,
        JsonNode scoreBreakdown
    ) {
        public static JobDetailResponse from(com.careerops.model.UserJob uj, com.careerops.model.Job j) {
            return new JobDetailResponse(
                uj.getId(), j.getId(), j.getTitle(), j.getCompany(), j.getLocation(),
                j.getSalaryMin(), j.getSalaryMax(), j.getCurrency(), j.getSponsorship(),
                j.getDescription(), j.getSourceUrl(), j.getSourceName(), j.getSector(),
                j.getPostedAt(), uj.getMatchPercent(), uj.getAiScore(),
                uj.getMatchedSkills(), uj.getUnmatchedSkills(), uj.getCvImprovementTips(),
                uj.getHumanSummary(), uj.getVerdict(), uj.getKanbanColumn(), uj.getStatus(),
                uj.getScoreBreakdown()
            );
        }
    }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record FetchSummary(
            int delivered,
            int dailyCount,
            int dailyLimit,
            int remaining,
            Boolean fullSearchStarted,
            String message
    ) {
        public FetchSummary(int delivered, int dailyCount, int dailyLimit, int remaining) {
            this(delivered, dailyCount, dailyLimit, remaining, null, null);
        }
    }

    @org.springframework.validation.annotation.Validated
    @io.swagger.v3.oas.annotations.media.Schema(description = "Request to update a job's kanban column and status")
    public record KanbanUpdateRequest(
        @jakarta.validation.constraints.NotBlank(message = "kanbanColumn is required")
        @io.swagger.v3.oas.annotations.media.Schema(example = "Applied")
        String kanbanColumn,

        @jakarta.validation.constraints.NotBlank(message = "status is required")
        @io.swagger.v3.oas.annotations.media.Schema(example = "active")
        String status
    ) {}

    public record JobListResponse(
        java.util.List<JobCardResponse> items,
        int dailyCount,
        int dailyLimit,
        int remaining,
        long totalCount,
        int page,
        int size,
        boolean hasMore,
        /** All non-deleted pipeline jobs (including below profile min-match %). */
        long pipelineTotal
    ) {
        /** Backward-compatible constructor for tests and call sites that omit pagination fields. */
        public JobListResponse(
            java.util.List<JobCardResponse> items,
            int dailyCount,
            int dailyLimit,
            int remaining) {
            this(items, dailyCount, dailyLimit, remaining, items.size(), 0, items.size(), false, items.size());
        }
    }

    public record JobSearchResponse(
        java.util.List<JobCardResponse> items,
        long total,
        int page,
        int size,
        int totalPages
    ) {}

    public record RecommendationResponse(
        UUID userJobId,
        String title,
        String company,
        String location,
        int matchPercent,
        Integer salaryMin,
        Integer salaryMax,
        String currency,
        String sourceUrl,
        String sourceName,
        Instant postedAt,
        Boolean sponsorship,
        String whyRecommended
    ) {}

    public record KanbanStatsResponse(
        long total,
        long applied,
        long interviews,
        long offers,
        double avgMatch
    ) {}
}
