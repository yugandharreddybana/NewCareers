# Auth security audit checklist

Closure tracker for the login/signup security audit (75 original findings + post-audit N-1…N-17).  
**Status:** all items **FIXED** after Batches A–D and auth security closure (June 2026).

Run full auth regression:

```bash
cd backend && mvn -q test -Dtest=AuthServiceTest,JwtServiceTest,HmacVerificationFilterTest,PublicPathPolicyTest,SecurityArchitectureTest,AuthControllerIntegrationTest,IpRateLimitFilterTest,SignupIntentServiceTest,CaptchaServiceTest,WordCaptchaServiceTest,OnboardingEmailVerificationServiceTest
cd middleware && npm test
cd frontend && npm test && npm run test:e2e:auth:chrome
```

| ID | Finding (summary) | Status | Verification command |
|----|-------------------|--------|----------------------|
| C-1 | Google auto-link requires password proof | FIXED | `mvn -q test -Dtest=AuthServiceTest#googleLinkRequiresVerificationForPasswordAccount` |
| C-2 | `resend.dev-mode` prod guard | FIXED | `mvn -q test -Dtest=ProductionSafetyConfig` + prod profile boot |
| C-3 | Word CAPTCHA SVG-only challenge | FIXED | `mvn -q test -Dtest=WordCaptchaServiceTest` |
| C-4 | No plaintext password in sessionStorage | FIXED | `npm test -- pendingSignup.test.ts` |
| C-5 | Refresh token HttpOnly cookie only | FIXED | `npm test -- tokenStore.test.ts` |
| H-1 | Access JWT revoked on logout/reset | FIXED | `mvn -q test -Dtest=JwtServiceTest,AuthServiceTest` |
| H-2 | JTI revocation persisted (DB) | FIXED | `mvn -q test -Dtest=JwtServiceTest` |
| H-3 | Java BFF-only; HMAC on protected routes | FIXED | `mvn -q test -Dtest=HmacVerificationFilterTest,InternalTrustFilterPublicPathTest` |
| H-4 | IP rate limit path normalization | FIXED | `mvn -q test -Dtest=IpRateLimitFilterTest` |
| H-5 | reCAPTCHA fail-closed prod/staging | FIXED | `mvn -q test -Dtest=CaptchaServiceTest` |
| H-6 | Refresh token reuse detection | FIXED | `mvn -q test -Dtest=AuthServiceTest` |
| H-7 | Reset verify generic errors (no 404 enum) | FIXED | `mvn -q test -Dtest=AuthServiceTest#verifyOtpUnknownEmail` |
| H-8 | Generic login failure (incl. lockout) | FIXED | `mvn -q test -Dtest=AuthServiceTest` |
| H-9 | Google-only accounts generic failure | FIXED | `mvn -q test -Dtest=AuthServiceTest` |
| H-10 | Prod CSRF memory token pattern | FIXED | `npm test -- publicAuthApi.test.ts` + middleware `server.ts` CSRF tests |
| H-11 | Login generic auth errors | FIXED | `npx playwright test auth-login.spec.ts -g "invalid"` |
| H-12 | Signup generic duplicate email | FIXED | `npx playwright test auth-signup-login.spec.ts -g "duplicate"` |
| H-13 | Signup-intent reCAPTCHA | FIXED | `mvn -q test -Dtest=SignupIntentServiceTest,CaptchaServiceTest` |
| H-14 | Google login consent sheet + CAPTCHA | FIXED | `npx playwright test auth-google-login.spec.ts` |
| H-15 | Login honors `captchaRequired` | FIXED | `npx playwright test auth-login.spec.ts` |
| H-16 | Prod build requires reCAPTCHA site key | FIXED | `NODE_ENV=production npm run build` (frontend) |
| H-17 | `/auth/me` fail clears client session | FIXED | `npm test -- ProtectedRoute.test.tsx` + AuthContext |
| H-18 | Safe redirect path guard | FIXED | `npm test -- ProtectedRoute.test.tsx` |
| H-19 | PWA excludes auth/profile API cache | FIXED | inspect `frontend/vite.config.ts` workbox rules |
| H-20 | Clear pending signup on login | FIXED | `npm test -- pendingSignup.test.ts` |
| M-1 | IP rate limits on all auth endpoints | FIXED | `mvn -q test -Dtest=IpRateLimitFilterTest` |
| M-2 | Trusted proxy IP for limits/binding | FIXED | `mvn -q test -Dtest=IpRateLimitFilterTest,AuthServiceTest#refreshRejectsBindingMismatch` |
| M-3 | Shared Redis rate limit prod/staging | FIXED | `application-prod.properties` + `application-staging.properties` |
| M-4 | HIBP fail-closed prod/staging | FIXED | `mvn -q test -Dtest=AuthServiceTest` |
| M-5 | Login password max length | FIXED | `mvn -q test -Dtest=AuthControllerIntegrationTest` |
| M-6 | 8-digit OTP | FIXED | `mvn -q test -Dtest=OnboardingEmailVerificationServiceTest` |
| M-7 | Refresh token SHA-256 hash intentional | FIXED | docs: `pagesflow/shared/auth-infrastructure.md` |
| M-8 | Word CAPTCHA shared store (Redis) | FIXED | ops: Redis + `WordCaptchaService` config |
| M-9 | Refresh IP/UA hard reject + family revoke | FIXED | `mvn -q test -Dtest=AuthServiceTest#refreshRejectsBindingMismatch` |
| M-10 | Google login respects account lockout | FIXED | `mvn -q test -Dtest=AuthServiceTest` |
| M-11 | check-email generic response | FIXED | `mvn -q test -Dtest=OnboardingEmailVerificationServiceTest` |
| M-12 | send-OTP generic response | FIXED | `mvn -q test -Dtest=OnboardingEmailVerificationServiceTest` |
| M-13 | Signup 409 generic message | FIXED | `mvn -q test -Dtest=AuthServiceTest` |
| M-14 | `emailVerificationId` required on signup | FIXED | `mvn -q test -Dtest=AuthServiceTest#signupRejectsMissingVerification` |
| M-15 | Onboarding password same rules as signup | FIXED | `mvn -q test -Dtest=AuthServiceTest` |
| M-16 | Change-password complexity pattern | FIXED | `mvn -q test -Dtest=AuthControllerIntegrationTest` |
| M-17 | parse-cv requires intent + CAPTCHA | FIXED | `mvn -q test -Dtest=SignupIntentServiceTest` + middleware parse-cv route |
| M-18 | Internal user ID UUID-only | FIXED | `mvn -q test -Dtest=InternalTrustFilterPublicPathTest` |
| M-19 | Admin role loaded from DB | FIXED | `mvn -q test -Dtest=SecurityArchitectureTest` |
| M-20 | Java CSRF off documented invariant | FIXED | `mvn -q test -Dtest=SecurityArchitectureTest` |
| M-21 | Swagger disabled in prod | FIXED | `mvn -q test -Dtest=PublicPathPolicyTest` |
| M-22 | Signup intent server validation | FIXED | `mvn -q test -Dtest=SignupIntentServiceTest` |
| M-23 | Client password rules match server | FIXED | `npm test -- passwordRules.test.ts buildOnboardingProfilePayload.test.ts` |
| M-24 | check-password gated/deprecated | FIXED | `grep check-password AuthController` + frontend API usage |
| M-25 | OTP send/resend CAPTCHA | FIXED | `mvn -q test -Dtest=OnboardingEmailVerificationServiceTest` |
| M-26 | Google consents UX handoff only | FIXED | docs: `pagesflow/shared/gdpr-data-storage.md` |
| M-27 | Reset-password no email deep link | FIXED | `npx playwright test auth-signup-login.spec.ts -g reset` |
| M-28 | Login strips `?email=` from URL | FIXED | `npx playwright test auth-login.spec.ts` |
| M-29 | Public auth paths omit Bearer | FIXED | `npm test -- publicAuthApi.test.ts tokenStore.test.ts` |
| M-30 | Word CAPTCHA fixed client length | FIXED | `mvn -q test -Dtest=WordCaptchaServiceTest` |
| M-31 | Forgot-password generic errors | FIXED | `npx playwright test auth-signup-login.spec.ts -g forgot` |
| M-32 | Generic username collision | FIXED | `npm test -- AuthContext` / onboarding tests |
| M-33 | Onboarding verification UX handoff only | FIXED | docs: `pagesflow/shared/gdpr-data-storage.md` |
| M-34 | DEV_AUTO_AUTH dev-only | FIXED | `npm test -- middleware authGuard` |
| M-35 | DEV_BYPASS stripped from prod build | FIXED | `frontend/vite.config.ts` define + `DevModeBanner.tsx` |
| L-1 | Word CAPTCHA profile gating | FIXED | `application-*.properties` + `env.ts` |
| L-2 | Google consents enforced in service | FIXED | `mvn -q test -Dtest=AuthServiceTest#newGoogleUserRecordsSignupConsents` |
| L-3 | Remember-me on refresh token row | FIXED | `mvn -q test -Dtest=AuthServiceTest#rememberMeLongerRefreshExpiry` |
| L-4 | Logout without refresh revokes access JWT only; refresh family cleared when `logoutAllDevices` or refresh cookie supplied | FIXED | `mvn -q test -Dtest=AuthServiceTest#logoutWithoutRefreshSkipsFamilyRevocation` |
| L-5 | Max refresh tokens per user | FIXED | `mvn -q test -Dtest=AuthServiceTest` |
| L-6 | OTP verify generic errors | FIXED | `mvn -q test -Dtest=OnboardingEmailVerificationServiceTest` |
| L-7 | CORS explicit origins | FIXED | `CorsConfig.java` + `pagesflow/shared/auth-infrastructure.md` |
| L-8 | HSTS enabled | FIXED | `SecurityConfig.java` |
| L-9 | Audit logs use userId not email | FIXED | `AuditLogService.java` |
| L-10 | Client signup password policy | FIXED | `npm test -- passwordRules.test.ts` |
| L-11 | Visible Google login button | FIXED | `LoginGoogleButton.tsx` |
| L-12 | AdminRoute client UX-only | FIXED | `pagesflow/shared/route-guards.md` |
| L-13 | Onboarding auth-failure redirect | FIXED | `npm test -- apiLoading.test.ts` |
| L-14 | AI consent enforced server-side for CV | FIXED | `mvn -q test -Dtest=SignupIntentServiceTest` |
| L-15 | Client JWT expiry advisory | FIXED | `npm test -- jwt.test.ts` |
| N-1 | Middleware forwards Google consents | FIXED | `npx playwright test auth-google-login.spec.ts -g N-1` |
| N-2 | Refresh binding uses TrustedProxyIpResolver | FIXED | `mvn -q test -Dtest=AuthServiceTest#refreshRejectsBindingMismatch` |
| N-3 | Word CAPTCHA SVG trusted server output | FIXED | `WordCaptchaField.tsx` + `WordCaptchaServiceTest` |
| N-4 | CaptchaService fail-closed staging | FIXED | `mvn -q test -Dtest=CaptchaServiceTest` |
| N-5 | Staging shared rate-limit store | FIXED | `application-staging.properties` |
| N-6 | Middleware trusted proxy IP (matches Java) | FIXED | `middleware npm test -- trustedClientIp` |
| N-7 | Onboarding verify oracle after sendOtp (decoy rows) | FIXED | `mvn -q test -Dtest=OnboardingEmailVerificationServiceTest#verifyEmailBadOtpSameMessageForRegisteredAndNew` |
| N-8 | Google link confirm reCAPTCHA when configured | FIXED | `npx playwright test auth-google-login.spec.ts -g N-8` |
| N-9 | confirmGoogleLink generic errors (no 404 enum) | FIXED | `mvn -q test -Dtest=AuthServiceTest#confirmGoogleLinkUnknownAccount` |
| N-10 | Google link confirm generic account-state messages | FIXED | `mvn -q test -Dtest=AuthServiceTest#confirmGoogleLinkWrongGoogleSub` |
| N-11 | Onboarding OTP modal generic UI errors | FIXED | `OnboardingEmailVerificationModal.tsx` + `authErrors.ts` |
| N-12 | Signup/signup-intent generic UI errors (no HIBP count leak) | FIXED | `Signup.tsx` + `AuthService` HIBP message |
| N-13 | Reset same-password generic after valid OTP | FIXED | `mvn -q test -Dtest=AuthServiceTest#verifyOtpSamePassword` |
| N-14 | Refresh generic errors (user deleted / binding mismatch) | FIXED | `mvn -q test -Dtest=AuthServiceTest#refreshUserDeleted` |
| N-15 | Dev parse-cv without intent (accepted dev-only risk) | DOCUMENTED | prod/staging gated in `AuthController.parseOnboardingCv` |
| N-16 | Auth e2e regression suite | FIXED | `npm run test:e2e:auth:chrome` |
| N-17 | Onboarding resend oracle after sendOtp | FIXED | `mvn -q test -Dtest=OnboardingEmailVerificationServiceTest#resendOtpRegisteredSkipsEmail` |
| N-18 | Onboarding finish outer catch leaks raw server errors | FIXED | `Onboarding.tsx` + `authErrors.ts` `GENERIC_ONBOARDING_PROFILE_ERROR` |
| N-19 | Signup maps all 400s to weak-password copy | FIXED | `mapSignupIntentError` in `authErrors.ts` + `authErrors.test.ts` |
| N-20 | E2E AI consent required on signup (SU-16) | FIXED | `npx playwright test auth-signup-login.spec.ts -g SU-16` |
| N-21 | App-wide safe user-facing errors (no raw `normalizedMessage`) | FIXED | `userFacingError.ts` + `userFacingError.test.ts` |
| N-22 | Login/refresh/google reject soft-deleted accounts | FIXED | `mvn -q test -Dtest=AuthServiceTest#loginRejectedForDeletedUser` |
| N-23 | Dead `signupIntentExists` client API removed | FIXED | `api.ts` (backend opaque endpoint retained) |

**Last updated:** June 2026 (auth security closure + production error hardening).
