package com.careerops.controller;

import com.careerops.dto.AuthDtos.*;
import com.careerops.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<AuthResponse> login(@RequestBody @Valid LoginRequest req) {
        return ResponseEntity.ok(auth.login(req));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgot(@RequestBody @Valid ForgotRequest req) {
        auth.forgot(req); return ResponseEntity.accepted().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> reset(@RequestBody @Valid VerifyOtpRequest req) {
        auth.verifyOtp(req); return ResponseEntity.ok().build();
    }
}
