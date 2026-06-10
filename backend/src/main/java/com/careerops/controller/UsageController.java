package com.careerops.controller;

import com.careerops.dto.UsageDtos.UsageLimitsResponse;
import com.careerops.ratelimit.RateLimited;
import com.careerops.dto.AnalyticsDtos.TokenUsageResponse;
import com.careerops.util.AuthUtil;
import com.careerops.service.UsageLimitService;
import com.careerops.service.TokenUsageService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/usage")
public class UsageController {

    private final UsageLimitService usageLimitService;
    private final TokenUsageService tokenUsageService;

    public UsageController(UsageLimitService usageLimitService, TokenUsageService tokenUsageService) {
        this.usageLimitService = usageLimitService;
        this.tokenUsageService = tokenUsageService;
    }

    /** GET /usage/limits — daily job + AI quotas for nav and settings. */
    @GetMapping("/limits")
    @RateLimited(capacity = 300, requestsPerMinute = 300)
    public UsageLimitsResponse limits() {
        UUID userId = AuthUtil.currentUserId();
        return usageLimitService.snapshot(userId);
    }

    /** GET /usage/tokens — per-feature/model token usage totals for the current user. */
    @GetMapping("/tokens")
    public TokenUsageResponse tokens() {
        UUID userId = AuthUtil.currentUserId();
        return tokenUsageService.getUsageForUser(userId);
    }
}
