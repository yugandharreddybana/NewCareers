package com.careerops.controller;

import com.careerops.dto.AuthDtos.*;
import com.careerops.dto.AuthDtos.OnboardingCvParseResponse;
import com.careerops.service.AuthService;
import com.careerops.service.OnboardingCvParseService;
import com.careerops.service.OnboardingEmailVerificationService;
import com.careerops.service.SignupIntentService;
import com.careerops.service.WordCaptchaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

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
@RequestMapping({"/auth", "/v1/auth"})
@io.micrometer.core.annotation.Timed
public class AuthController {

    private final AuthService auth;
    private final SignupIntentService signupIntentService;
    private final OnboardingEmailVerificationService onboardingVerification;
    private final OnboardingCvParseService onboardingCvParse;
    private final WordCaptchaService wordCaptcha;
    private final Environment environment;

    public AuthController(AuthService auth,
                          SignupIntentService signupIntentService,
                          OnboardingEmailVerificationService onboardingVerification,
                          OnboardingCvParseService onboardingCvParse,
                          WordCaptchaService wordCaptcha,
                          Environment environment) {
        this.auth = auth;
        this.signupIntentService = signupIntentService;
        this.onboardingVerification = onboardingVerification;
        this.onboardingCvParse = onboardingCvParse;
        this.wordCaptcha = wordCaptcha;
        this.environment = environment;
    }

    @GetMapping("/captcha/challenge")
    public WordCaptchaChallengeResponse captchaChallenge() {
        return wordCaptcha.createChallenge();
    }

    @PostMapping("/signup-intent")
    public SignupIntentResponse signupIntent(@RequestBody @Valid SignupIntentRequest req) {
        return signupIntentService.create(req);
    }

    @GetMapping("/signup-intent/{id}/exists")
    public SignupIntentExistsResponse signupIntentExists(@PathVariable UUID id) {
        return signupIntentService.exists(id);
    }

    @PostMapping("/register")
    public AuthResponse register(@RequestBody @Valid SignupRequest req,
                                 HttpServletRequest httpRequest) {
        return auth.signup(req, httpRequest);
    }

    @PostMapping("/login")
    public LoginFlowResponse login(@RequestBody @Valid LoginRequest req,
                                   HttpServletRequest httpRequest) {
        return auth.login(req, httpRequest);
    }

    @PostMapping("/two-factor/verify")
    public AuthResponse verifyTwoFactor(@RequestBody @Valid com.careerops.dto.SecurityDtos.TwoFactorVerifyRequest req,
                                        HttpServletRequest httpRequest) {
        return auth.verifyTwoFactorLogin(req, httpRequest);
    }

    @PostMapping("/google")
    public AuthResponse google(@RequestBody @Valid GoogleAuthRequest req,
                               HttpServletRequest httpRequest) {
        return auth.authenticateWithGoogle(req, httpRequest);
    }

    @PostMapping("/google/link/confirm")
    public AuthResponse confirmGoogleLink(@RequestBody @Valid GoogleLinkConfirmRequest req,
                                          HttpServletRequest httpRequest) {
        return auth.confirmGoogleLink(req, httpRequest);
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

    @PostMapping("/onboarding/check-password")
    public OnboardingCheckPasswordResponse checkOnboardingPassword(
            @RequestBody @Valid OnboardingCheckPasswordRequest req) {
        signupIntentService.assertValidForPasswordCheck(req.signupIntentId(), req.email());
        auth.validateOnboardingPassword(req.password(), req.email());
        return new OnboardingCheckPasswordResponse(true);
    }

    @PostMapping("/onboarding/send-verification-otp")
    @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public OnboardingOtpSentResponse sendOnboardingVerificationOtp(
            @RequestBody @Valid OnboardingSendOtpRequest req) {
        return onboardingVerification.sendOtp(req.email(), req.firstName(), req.captchaToken());
    }

    @PostMapping("/onboarding/resend-verification-otp")
    @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public OnboardingOtpSentResponse resendOnboardingVerificationOtp(
            @RequestBody @Valid OnboardingResendOtpRequest req) {
        return onboardingVerification.resendOtp(req.email(), req.captchaToken());
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
    public OnboardingCvParseResponse parseOnboardingCv(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "signupIntentId", required = false) UUID signupIntentId,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "captchaToken", required = false) String captchaToken)
            throws IOException {
        boolean requireSignupSession = environment.acceptsProfiles(Profiles.of("prod", "staging"));
        if (requireSignupSession) {
            if (signupIntentId == null) {
                throw new com.careerops.exception.ApiException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "Sign-up session required.");
            }
            if (email == null || email.isBlank()) {
                throw new com.careerops.exception.ApiException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "Email is required with sign-up session.");
            }
            auth.requireRecaptchaWhenConfigured(captchaToken);
        }
        if (signupIntentId != null) {
            if (email == null || email.isBlank()) {
                throw new com.careerops.exception.ApiException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "Email is required with sign-up session.");
            }
            signupIntentService.assertEligibleForCvParse(signupIntentId, email);
        }
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
        String refreshToken = req != null ? req.refreshToken() : null;
        String accessToken = resolveAccessToken(req, httpRequest);
        boolean logoutAll = req != null && Boolean.TRUE.equals(req.logoutAllDevices());
        auth.logout(com.careerops.util.AuthUtil.currentUserId(), refreshToken, accessToken, logoutAll, httpRequest);
    }

    private static String resolveAccessToken(LogoutRequest req, HttpServletRequest httpRequest) {
        if (req != null && req.accessToken() != null && !req.accessToken().isBlank()) {
            return req.accessToken();
        }
        String auth = httpRequest.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7).trim();
        }
        return null;
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
