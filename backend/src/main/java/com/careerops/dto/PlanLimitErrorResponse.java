package com.careerops.dto;

public record PlanLimitErrorResponse(
        String error,
        String feature,
        String currentPlan,
        String upgradeUrl) {}
