package com.careerops.controller;

import com.careerops.service.ReferralService;
import com.careerops.service.ReferralService.ReferralDto;
import com.careerops.util.AuthUtil;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section 9 — Task 97.
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/referrals")
@io.micrometer.core.annotation.Timed
public class ReferralController {

    private final ReferralService referralService;

    public ReferralController(ReferralService referralService) {
        this.referralService = referralService;
    }

    public record CreateReferralRequest(
        @jakarta.validation.constraints.NotBlank(message = "email is required")
        @jakarta.validation.constraints.Email(message = "invalid email format")
        String email
    ) {}

    /** POST /referrals  — body: { "email": "friend@example.com" } */
    @PostMapping
    public ReferralDto create(@jakarta.validation.Valid @RequestBody CreateReferralRequest req) {
        return referralService.createReferral(AuthUtil.currentUserId(), req.email().trim());
    }

    /** GET /referrals/my  — returns { referrals: [...], stats: {...} } */
    @GetMapping("/my")
    public Map<String, Object> my() {
        UUID userId = AuthUtil.currentUserId();
        List<ReferralDto> list  = referralService.getMyReferrals(userId);
        Map<String, Object> stats = referralService.getMyStats(userId);
        return Map.of("referrals", list, "stats", stats);
    }

    /**
     * GET /referrals/validate/:token
     * Public endpoint — called on the Signup page when ?ref=TOKEN is present.
     * Returns { valid, referrerName, status, tokenType }.
     */
    @GetMapping("/validate/{token}")
    public Map<String, Object> validate(@PathVariable UUID token) {
        return referralService.validateToken(token);
    }
}
