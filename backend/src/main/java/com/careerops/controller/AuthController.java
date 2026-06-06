package com.careerops.controller;

import com.careerops.dto.AuthDtos.*;
import com.careerops.dto.AuthDtos.OnboardingCvParseResponse;
import com.careerops.service.AuthService;
import com.careerops.service.OnboardingCvParseService;
import com.careerops.service.OnboardingEmailVerificationService;
import com.careerops.service.WordCaptchaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Task 118 — adds POST /auth/refresh and POST /auth/logout.
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/auth")
@io.micrometer.core.annotation.Timed
public class AuthController {

    private final AuthService auth;
    private final OnboardingEmailVerificationService onboardingVerification;
    private final OnboardingCvParseService onboardingCvParse;
    private final WordCaptchaService wordCaptcha;

    public AuthController(AuthService auth,
                          OnboardingEmailVerificationService onboardingVerification,
                          OnboardingCvParseService onboardingCvParse,
                          WordCaptchaService wordCaptcha) {
        this.auth = auth;
        this.onboardingVerification = onboardingVerification;
        this.onboardingCvParse = onboardingCvParse;
        this.wordCaptcha = wordCaptcha;
    }

    @GetMapping("/captcha/challenge")
    public WordCaptchaChallengeResponse captchaChallenge() {
        return wordCaptcha.createChallenge();
    }

    @PostMapping("/register")
    public AuthResponse register(@RequestBody @Valid SignupRequest req,
                                 HttpServletRequest httpRequest) {
        return auth.signup(req, httpRequest);
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody @Valid LoginRequest req,
                                              HttpServletRequest httpRequest) {
        return auth.login(req, httpRequest);
    }

    @PostMapping("/google")
    public AuthResponse google(@RequestBody @Valid GoogleAuthRequest req,
                               HttpServletRequest httpRequest) {
        return auth.authenticateWithGoogle(req, httpRequest);
    }

    @PostMapping("/forgot-password")
    @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public void forgot(@RequestBody @Valid ForgotRequest req) {
        auth.forgot(req);
    }

    @PostMapping("/reset-password")
    public void reset(@RequestBody @Valid VerifyOtpRequest req) {
        auth.verifyOtp(req);
    }

    @PostMapping("/onboarding/check-email")
    public OnboardingCheckEmailResponse checkOnboardingEmail(
            @RequestBody @Valid OnboardingCheckEmailRequest req) {
        onboardingVerification.checkEmailAvailable(req.email());
        return new OnboardingCheckEmailResponse(true);
    }

    @PostMapping("/onboarding/send-verification-otp")
    @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public OnboardingOtpSentResponse sendOnboardingVerificationOtp(
            @RequestBody @Valid OnboardingSendOtpRequest req) {
        return onboardingVerification.sendOtp(req.email(), req.firstName());
    }

    @PostMapping("/onboarding/resend-verification-otp")
    @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public OnboardingOtpSentResponse resendOnboardingVerificationOtp(
            @RequestBody @Valid OnboardingResendOtpRequest req) {
        return onboardingVerification.resendOtp(req.email());
    }

    @PostMapping("/onboarding/verify-email")
    public OnboardingVerificationResponse verifyOnboardingEmail(
            @RequestBody @Valid OnboardingVerifyEmailRequest req) {
        return onboardingVerification.verifyEmail(req.email(), req.otp(), req.captchaToken());
    }

    /**
     * POST /auth/onboarding/parse-cv — stateless CV parse for onboarding step 0.
     * Extracts work experience, education, projects, and a markdown preview.
     */
    @PostMapping("/onboarding/parse-cv")
    public OnboardingCvParseResponse parseOnboardingCv(@RequestPart("file") MultipartFile file)
            throws IOException {
        return onboardingCvParse.parse(file);
    }

    /**
     * POST /auth/refresh
     * Accepts the raw refresh token, validates it, rotates it, and returns
     * a new access token + new refresh token.
     * Used by the frontend Axios interceptor (Task 120) to silently re-auth on 401.
     */
    @PostMapping("/refresh")
    public AuthResponse refresh(@RequestBody @Valid RefreshRequest req,
                                                HttpServletRequest httpRequest) {
        return auth.refresh(req.refreshToken(), httpRequest);
    }

    /**
     * POST /auth/logout
     * Blacklists the current user's refresh token.
     * Requires the JWT auth guard — userId extracted from security context.
     */
    @PostMapping("/logout")
    public void logout(@RequestBody(required = false) LogoutRequest req,
                                               HttpServletRequest httpRequest) {
        String token = req != null ? req.refreshToken() : null;
        auth.logout(com.careerops.util.AuthUtil.currentUserId(), token, httpRequest);
    }

    /**
     * GET /auth/me — returns the currently authenticated user.
     *
     * Pass 6 #6.045 — frontend AuthContext calls this on mount to verify the
     * session and pick up role/onboarded changes. Auth happens via the standard
     * trust filter, so userId is read from {@link com.careerops.util.AuthUtil}.
     */
    @GetMapping("/me")
    public UserDto me() {
        return auth.me(com.careerops.util.AuthUtil.currentUserId());
    }
}
