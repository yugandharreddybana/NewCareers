package com.careerops.controller;

import com.careerops.dto.AuthDtos.*;
import com.careerops.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Task 118 — adds POST /auth/refresh and POST /auth/logout.
 * All existing endpoints (register, login, forgot-password, reset-password) are unchanged.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) { this.auth = auth; }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody @Valid SignupRequest req) {
        return ResponseEntity.ok(auth.signup(req));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody @Valid LoginRequest req,
                                              HttpServletRequest httpRequest) {
        return ResponseEntity.ok(auth.login(req, httpRequest));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgot(@RequestBody @Valid ForgotRequest req) {
        auth.forgot(req);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> reset(@RequestBody @Valid VerifyOtpRequest req) {
        auth.verifyOtp(req);
        return ResponseEntity.ok().build();
    }

    /**
     * POST /auth/refresh
     * Accepts the raw refresh token, validates it, rotates it, and returns
     * a new access token + new refresh token.
     * Used by the frontend Axios interceptor (Task 120) to silently re-auth on 401.
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody @Valid RefreshRequest req,
                                                HttpServletRequest httpRequest) {
        return ResponseEntity.ok(auth.refresh(req.refreshToken(), httpRequest));
    }

    /**
     * POST /auth/logout
     * Blacklists the current user's refresh token.
     * Requires the JWT auth guard — userId extracted from security context.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest,
                                       @RequestAttribute("userId") String userId) {
        auth.logout(java.util.UUID.fromString(userId), httpRequest);
        return ResponseEntity.ok().build();
    }
}
