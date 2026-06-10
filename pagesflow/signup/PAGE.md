# Signup

## Overview

First step of deferred signup: collects name, email, password, and consent checkboxes but does **not** create an account yet. Creates a short-lived **signup intent** server-side, then stores the intent id, email, consents, and client expiry in `sessionStorage` (`pendingSignup`) and navigates to `/onboarding`. The plaintext password stays server-side with the intent. Account registration happens on onboarding finish. Guests only.

## Route

| Property | Value |
|----------|-------|
| URL | `/signup` (canonical); `/register` redirects here |
| Guard | `GuestRoute` |
| Layout | Standalone (`SignupPageShell`) |
| Redirects | Logged-in user → `/dashboard` or `/onboarding` per `loginRedirectTarget` |

### Query parameters

| Param | Effect |
|-------|--------|
| `?reason=session_expired` | Clears tokens, pending signup, verification; shows "sign-up session expired" banner |

## Fields and inputs

| Field | Required | Validation | When shown |
|-------|----------|------------|------------|
| Full name | Yes | Non-empty trim | Always |
| Email | Yes | HTML5 email; trimmed on submit | Always |
| Password | Yes | Client strength: min 8 chars; score ≥3 (Good/Strong) to proceed | Always |
| Terms of Service + Privacy Policy | Yes | `termsAccepted` must be true | Always |
| AI processing consent | Yes | Required client- and server-side for CV parse during onboarding | Always |
| Marketing emails | No | Optional | Always |
| Analytics consent | No | Optional; also written to local cookie consent | Always |

Password strength labels: Too short (<8), Weak, Fair (not acceptable), Good, Strong (acceptable).

## Actions

| Action | Trigger | Result |
|--------|---------|--------|
| Continue to profile | Form submit | `authApi.createSignupIntent` → `writePendingSignup` → `navigate('/onboarding')` |
| Duplicate email (decoy) | 200 with random UUID (not stored) | UI proceeds to onboarding; register fails later at finish |
| Sign in (footer) | Link | Navigate to `/login` |
| Open legal docs | Terms/Privacy links | New tab to `/terms`, `/privacy` |

On submit success, consents are also persisted via `writePendingGoogleConsents` and `writeAnalyticsConsent` for Google OAuth path consistency.

## Auth and session

No account is created on this page. Only non-secret handoff state lives in tab-scoped session storage:

| Key | Storage | TTL |
|-----|---------|-----|
| `co_pending_signup_v2` | `sessionStorage` | Signup intent id, email, consents, optional name; TTL from server `expiresAt` (30 min default); `readPendingSignup` requires `aiProcessingAccepted === true` |
| `co_google_consents_v1` | `sessionStorage` | Consents for Google OAuth path reuse |

`OnboardingRoute` requires `hasPendingSignup()` for guests without a user session.

Session-expired cleanup (`?reason=session_expired`): clears `tokenStore`, `pendingSignup`, `onboardingVerification`, and best-effort `authApi.logout()`.

## API endpoints

| User action | Frontend | Middleware (`/api/v1`) | Java (`/api`) |
|-------------|----------|------------------------|---------------|
| Create signup intent | `authApi.createSignupIntent` | `POST /auth/signup-intent` | `POST /auth/signup-intent` |
| Logout (session expired cleanup) | `authApi.logout` | `POST /auth/logout` | `POST /auth/logout` |

Signup-intent success: `{ signupIntentId, expiresAt }` (30 min server TTL). Client stores server `expiresAt` in `writePendingSignup`. Existing email: HTTP **200 decoy** (random UUID never persisted; anti-enumeration). Intent consume at register is atomic (`consumeIfActive`). API errors mapped via `mapSignupIntentError` (400 weak password/captcha, 429 rate limit, 503 HIBP unavailable). reCAPTCHA widget reset on submit failure (`captchaRef.reset()`).

Legacy `POST /auth/onboarding/check-email` remains for compatibility but always returns `{ available: true }` to prevent email enumeration. `GET /auth/signup-intent/{id}/exists` removed.

Actual registration (`POST /auth/register`) is deferred to onboarding finish — includes reCAPTCHA when configured, email verification consume, and `OrgProvisioningService.provisionForNewUser` — see [onboarding/PAGE.md](../onboarding/PAGE.md).

## File map

### Frontend

| Role | Path |
|------|------|
| Page | `frontend/src/pages/Signup.tsx` |
| Shell | `frontend/src/components/auth/SignupPageShell.tsx` |
| Pending signup store | `frontend/src/lib/pendingSignup.ts` |
| Auth error constants | `frontend/src/lib/authErrors.ts` |
| Google consent handoff | `frontend/src/lib/pendingGoogleConsents.ts` |
| Analytics consent | `frontend/src/lib/cookieConsent.ts` |
| Verification cleanup | `frontend/src/lib/onboardingVerification.ts` |
| HTTP client | `frontend/src/services/api.ts` |
| Route guard | `frontend/src/components/ProtectedRoute.tsx` (`GuestRoute`) |

### Middleware

| Role | Path |
|------|------|
| Signup-intent route | `middleware/src/routes/auth.routes.ts` — `POST /signup-intent` |

### Backend

| Role | Path |
|------|------|
| Controller | `backend/src/main/java/com/careerops/controller/AuthController.java` |
| Signup intent | `backend/src/main/java/com/careerops/service/SignupIntentService.java` |
| Registration (deferred) | `backend/src/main/java/com/careerops/service/AuthService.java` — `signup` |
| Org provisioning | `backend/src/main/java/com/careerops/service/OrgProvisioningService.java` |

## Sequence diagram

```mermaid
sequenceDiagram
    participant Signup as Signup.tsx
    participant Axios
    participant Middleware
    participant Java as SignupIntentService
    participant Storage as sessionStorage

    Signup->>Signup: validate name, password strength, terms, AI consent
    Signup->>Axios: POST /auth/signup-intent { email, password, consents, name? }
    Axios->>Middleware: proxy
    Middleware->>Java: POST /auth/signup-intent

    alt email already registered decoy
        Java-->>Signup: 200 random signupIntentId not stored
        Signup->>Storage: writePendingSignup same as new email
        Signup->>Signup: navigate(/onboarding, replace)
    else new email
        Java-->>Signup: { signupIntentId, expiresAt }
        Signup->>Storage: writePendingSignup({ signupIntentId, email, consents, name?, expiresAt })
        Signup->>Storage: writePendingGoogleConsents, writeAnalyticsConsent
        Signup->>Signup: navigate(/onboarding, replace)
    end
```

## Edge cases

- **Deferred account creation**: Closing the tab loses `pendingSignup`; user must restart from signup.
- **Duplicate email (decoy)**: Server returns 200 with fake intent id; user reaches onboarding but register fails at finish with generic error.
- **Weak password**: Blocked client-side; server 400 (HIBP pwned) or 503 (HIBP unavailable in prod).
- **Terms / AI consent not accepted**: Blocked client-side; server 400 if missing.
- **reCAPTCHA failure**: 400 Security verification failed; `captchaRef.reset()` on every submit failure.
- **Rate limits**: Middleware authLimiter 20/15min; Java IP 20/min → 429.
- **Session expired on signup URL**: Wipes tokens, pending signup, verification; user re-enters form.
- **Logged-in user**: `GuestRoute` redirects away before form is usable.
- **Legacy `/register`**: Permanent redirect to `/signup` in `App.tsx`.
- **No Google button on signup**: Google OAuth on `/login` only; consents from signup reused via `pendingGoogleConsents`.

## Related docs

- [signup-onboarding-pipeline.docx](../signup-onboarding/signup-onboarding-pipeline.docx) — full combined pipeline reference with phased sequence diagrams (DOCX)
- [shared/auth-infrastructure.md](../shared/auth-infrastructure.md)
- [shared/route-guards.md](../shared/route-guards.md)
- [onboarding/PAGE.md](../onboarding/PAGE.md)
