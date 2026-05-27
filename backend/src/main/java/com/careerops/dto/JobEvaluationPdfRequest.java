package com.careerops.dto;

import java.util.List;
import java.util.Map;

/**
 * Payload for rendering a job evaluation PDF from client-side evaluation view
 * (preview jobs and fresh modal state).
 */
public record JobEvaluationPdfRequest(
    String title,
    String company,
    String location,
    Integer matchPercent,
    Integer overallScore,
    String verdict,
    String humanSummary,
    List<String> matchedSkills,
    List<String> unmatchedSkills,
    List<String> cvImprovementTips,
    Map<String, Double> dimensionScores,
    List<DimensionDto> dimensions,
    Double applyScore,
    String archetype,
    Boolean isPreview,
    String disclaimer,
    String previewWatermark,
    EvaluationSectionsDto sections
) {
    public record DimensionDto(
        String key,
        String label,
        Double score,
        Double weight,
        String reason
    ) {}
    public record EvaluationSectionsDto(
        String executiveSummary,
        String backgroundMatch,
        String positioningStrategy,
        String compensationAndMarket,
        String tailoringPlan,
        String interviewPrep
    ) {}
}
