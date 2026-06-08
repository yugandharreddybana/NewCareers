package com.careerops.exception;

import com.careerops.dto.PlanLimitErrorResponse;
import com.careerops.model.SubscriptionPlan;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PlanEnforcementProdProfileTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
    }

    @Test
    void planLimitExceededReturns402WithSpecBody() {
        PlanLimitExceededException ex = PlanLimitExceededException.of("ai_skill_run", SubscriptionPlan.FREE);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/skills/start");
        ServletWebRequest webRequest = new ServletWebRequest(request);

        ResponseEntity<PlanLimitErrorResponse> response = handler.handlePlanLimitExceeded(ex, webRequest);

        assertEquals(HttpStatus.PAYMENT_REQUIRED, response.getStatusCode());
        PlanLimitErrorResponse body = response.getBody();
        assertEquals("PLAN_LIMIT_EXCEEDED", body.error());
        assertEquals("ai_skill_run", body.feature());
        assertEquals("FREE", body.currentPlan());
        assertEquals("/pricing", body.upgradeUrl());
    }
}
