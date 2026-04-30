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
 * POST  /referrals            → create referral + send invite email
 * GET   /referrals/my         → list referrals for current user + stats
 * GET   /referrals/validate/:token → validate a referral token (public, used on signup page)
 */
@RestController
@RequestMapping("/referrals")
public class ReferralController {

    private final ReferralService referralService;

    public ReferralController(ReferralService referralService) {
        this.referralService = referralService;
    }

    /** POST /referrals  — body: { "email": "friend@example.com" } */
    @PostMapping
    public ReferralDto create(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim();
        if (email.isEmpty())
            throw new com.careerops.exception.ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "email is required");
        return referralService.createReferral(AuthUtil.currentUserId(), email);
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
