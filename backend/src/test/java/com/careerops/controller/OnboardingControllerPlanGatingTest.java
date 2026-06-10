package com.careerops.controller;

import com.careerops.annotation.PlanGated;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OnboardingControllerPlanGatingTest {

    @Test
    void deliveryStartIsPlanGatedAsAiRun() throws NoSuchMethodException {
        PlanGated annotation = OnboardingController.class
                .getMethod("startDelivery", boolean.class)
                .getAnnotation(PlanGated.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).isEqualTo("ai_skill_run");
    }
}
