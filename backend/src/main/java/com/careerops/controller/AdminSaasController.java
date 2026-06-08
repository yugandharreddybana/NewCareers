package com.careerops.controller;

import com.careerops.dto.AdminSaasDtos.AiUsageRow;
import com.careerops.dto.AdminSaasDtos.FeatureFlagRow;
import com.careerops.dto.AdminSaasDtos.OverridePlanRequest;
import com.careerops.dto.AdminSaasDtos.PagedSubscriptionsResponse;
import com.careerops.dto.AdminSaasDtos.SaasMetricsResponse;
import com.careerops.dto.AdminSaasDtos.SubscriptionRow;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.service.AdminSaasService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/admin/saas", "/v1/admin/saas"})
@PreAuthorize("hasRole('ADMIN')")
public class AdminSaasController {

    private final AdminSaasService adminSaasService;

    public AdminSaasController(AdminSaasService adminSaasService) {
        this.adminSaasService = adminSaasService;
    }

    @GetMapping("/metrics")
    public SaasMetricsResponse getMetrics() {
        return adminSaasService.getMetrics();
    }

    @GetMapping("/subscriptions")
    public PagedSubscriptionsResponse listSubscriptions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) SubscriptionPlan plan,
            @RequestParam(required = false) SubscriptionStatus status,
            @RequestParam(required = false) String search) {
        return adminSaasService.listSubscriptions(page, size, plan, status, search);
    }

    @PostMapping("/subscriptions/{orgId}/override-plan")
    public SubscriptionRow overridePlan(
            @PathVariable UUID orgId,
            @Valid @RequestBody OverridePlanRequest request) {
        return adminSaasService.overridePlan(orgId, request);
    }

    @GetMapping("/feature-flags")
    public List<FeatureFlagRow> listFeatureFlags() {
        return adminSaasService.listFeatureFlags();
    }

    @PostMapping("/feature-flags/{id}/toggle")
    public FeatureFlagRow toggleFeatureFlag(@PathVariable UUID id) {
        return adminSaasService.toggleFeatureFlag(id);
    }

    @GetMapping("/ai-usage")
    public List<AiUsageRow> topAiUsage() {
        return adminSaasService.topAiUsageThisMonth();
    }
}
