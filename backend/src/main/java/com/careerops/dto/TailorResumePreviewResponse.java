package com.careerops.dto;

public record TailorResumePreviewResponse(
        String html,
        String tailoredMarkdown,
        String baselineMarkdown) {}
