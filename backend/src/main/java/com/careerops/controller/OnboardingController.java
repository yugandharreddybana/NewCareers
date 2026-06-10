package com.careerops.controller;

import com.careerops.annotation.PlanGated;
import com.careerops.ratelimit.RateLimited;
import com.careerops.dto.OnboardingDeliveryDtos.DeliveryStatusResponse;
import com.careerops.dto.OnboardingDeliveryDtos.StartDeliveryResponse;
import com.careerops.service.OnboardingAnalyticsService;
import com.careerops.service.OnboardingDeliveryService;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/onboarding")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingAnalyticsService analyticsService;
    private final OnboardingDeliveryService deliveryService;

    public record TrackEventRequest(
        String type,
        String step,
        String eventType,
        String feature,
        String action,
        Map<String, Object> metadata
    ) {}

    // Task 74 — GET /onboarding/checklist
    // Returns the list of onboarding step keys the user has completed
    @GetMapping("/checklist")
    public Map<String, Object> getChecklist() {
        UUID userId = AuthUtil.currentUserId();
        List<String> completedSteps = analyticsService.getCompletedSteps(userId);
        return Map.of(
            "completedSteps", completedSteps
        );
    }

    /** Track A — start first-run job delivery (CV normalize → scrape → evaluate). */
    @PostMapping("/delivery/start")
    @PlanGated("ai_skill_run")
    public StartDeliveryResponse startDelivery(
            @RequestParam(defaultValue = "false") boolean restart) {
        return deliveryService.start(AuthUtil.currentUserId(), restart);
    }

    /** Track A — poll delivery progress for the onboarding loader. */
    @GetMapping("/delivery/status")
    @RateLimited(capacity = 300, requestsPerMinute = 300)
    public DeliveryStatusResponse deliveryStatus() {
        return deliveryService.status(AuthUtil.currentUserId());
    }

    // Tasks 69+70 — POST /onboarding/event
    @PostMapping("/event")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void trackEvent(
            @RequestBody TrackEventRequest body) {
        UUID userId = AuthUtil.currentUserId();

        if (body == null || body.step() == null) {
            throw com.careerops.exception.ApiException.badRequest("Missing step field");
        }

        String type = body.type() != null ? body.type() : "onboarding"; // 'onboarding' | 'feature'
        String step = body.step();
        String event = body.eventType() != null ? body.eventType() : "completed";
        Map<String, Object> metadata = body.metadata() != null ? body.metadata() : Map.of();

        if ("feature".equals(type)) {
            String feature = body.feature() != null ? body.feature() : step;
            String action  = body.action() != null ? body.action() : event;
            analyticsService.trackFeatureAdoption(userId, feature, action, metadata);
            analyticsService.trackOnboardingStep(userId, step, event, metadata);
        }
    }
}
