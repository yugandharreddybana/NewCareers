package com.careerops.dto;

import java.util.List;
import java.util.UUID;

public class AnalyticsDtos {

    public record TokenUsageSummary(
        String feature,
        String model,
        long totalTokens,
        double totalCostUsd,
        long requestCount
    ) {}

    public record TokenUsageResponse(
        List<TokenUsageSummary> byFeature,
        long grandTotalTokens,
        double grandTotalCostUsd,
        double estimatedMonthlyCost
    ) {}

    public record RecommendationFeedbackRequest(
        String feedbackType,
        String reason,
        UUID userJobId
    ) {}
}
