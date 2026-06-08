package com.careerops.controller;

import com.careerops.dto.SecurityDtos.*;
import com.careerops.service.AccountSecurityService;
import com.careerops.service.TwoFactorService;
import com.careerops.util.AuthUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/account")
@RequiredArgsConstructor
@io.micrometer.core.annotation.Timed
public class SecurityController {

    private final AccountSecurityService security;
    private final TwoFactorService twoFactor;

    record RevokeOthersResponse(int revoked) {}

    @GetMapping("/sessions")
    public List<SessionResponse> listSessions(
            @RequestHeader(value = "X-Refresh-Token", required = false) String refreshToken
    ) {
        return security.listSessions(AuthUtil.currentUserId(), refreshToken);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public void revokeSession(
            @PathVariable UUID sessionId,
            HttpServletRequest request,
            @RequestHeader(value = "X-Refresh-Token", required = false) String refreshToken
    ) {
        security.revokeSession(AuthUtil.currentUserId(), sessionId, refreshToken, request);
    }

    @PostMapping("/sessions/revoke-others")
    public RevokeOthersResponse revokeOtherSessions(
            HttpServletRequest request,
            @RequestHeader(value = "X-Refresh-Token", required = false) String refreshToken
    ) {
        int revoked = security.revokeOtherSessions(AuthUtil.currentUserId(), refreshToken, request);
        return new RevokeOthersResponse(revoked);
    }

    @GetMapping("/security/activity")
    public SecurityActivityResponse securityActivity(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return security.listSecurityActivity(AuthUtil.currentUserId(), page, size);
    }

    @GetMapping("/two-factor/status")
    public TwoFactorStatusResponse twoFactorStatus() {
        return twoFactor.getStatus(AuthUtil.currentUserId());
    }

    @PostMapping("/two-factor/setup")
    public TwoFactorSetupResponse twoFactorSetup() {
        return twoFactor.beginSetup(AuthUtil.currentUserId());
    }

    @PostMapping("/two-factor/enable")
    public TwoFactorEnableResponse twoFactorEnable(
            @RequestBody @Valid TwoFactorEnableRequest req,
            HttpServletRequest request
    ) {
        return twoFactor.confirmSetup(AuthUtil.currentUserId(), req.code(), request);
    }

    @PostMapping("/two-factor/disable")
    public void twoFactorDisable(
            @RequestBody @Valid TwoFactorDisableRequest req,
            HttpServletRequest request
    ) {
        twoFactor.disable(AuthUtil.currentUserId(), req.currentPassword(), request);
    }
}
