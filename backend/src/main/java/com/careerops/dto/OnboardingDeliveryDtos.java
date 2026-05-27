package com.careerops.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * First-run onboarding job delivery — polled by the frontend loader.
 */
public final class OnboardingDeliveryDtos {

    private OnboardingDeliveryDtos() {}

    public static final int DEFAULT_TARGET_COUNT = 10;
    public static final int DEFAULT_MIN_EVALUATED = 3;

    public enum Stage {
        idle,
        reading_cv,
        normalizing_cv,
        fetching_jobs,
        evaluating_jobs,
        ready_partial,
        ready,
        failed
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DeliveryStatusResponse(
        String stage,
        String message,
        int evaluatedCount,
        int targetCount,
        int minRequired,
        int jobsDiscovered,
        boolean readyPartial,
        boolean ready,
        String error
    ) {}

    public record StartDeliveryResponse(
        String stage,
        String message
    ) {}
}
