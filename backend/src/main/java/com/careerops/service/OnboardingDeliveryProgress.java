package com.careerops.service;

import com.careerops.dto.OnboardingDeliveryDtos.Stage;

/**
 * Mutable progress snapshot written to user_profiles.onboarding_delivery.
 */
public record OnboardingDeliveryProgress(
    Stage stage,
    String message,
    int evaluatedCount,
    int targetCount,
    int minRequired,
    int jobsDiscovered,
    String error
) {
    public boolean readyPartial() {
        return evaluatedCount >= minRequired
            && (stage == Stage.ready_partial || stage == Stage.ready || stage == Stage.evaluating_jobs);
    }

    public boolean ready() {
        return stage == Stage.ready || (stage == Stage.ready_partial && evaluatedCount >= targetCount);
    }
}
