# Signup

## Overview

First step of deferred signup: collects name, email, password, and consent checkboxes but does **not** create an account yet. Creates a short-lived **signup intent** server-side, then stores the intent id and consents in `sessionStorage` (`pendingSignup`) and navigates to `/onboarding`. Account registration happens on onboarding finish. Guests only.

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
| Duplicate email | 409 on signup-intent | Shows generic inline duplicate-email alert (no login handoff link) |
| Sign in (footer) | Link | Navigate to `/login` |
| Open legal docs | Terms/Privacy links | New tab to `/terms`, `/privacy` |

On submit success, consents are also persisted via `writePendingGoogleConsents` and `writeAnalyticsConsent` for Google OAuth path consistency.

## Auth and session

No account is created on this page. Credentials live in tab-scoped session storage:

| Key | Storage | TTL |
|-----|---------|-----|
| `co_pending_signup_v1` | `sessionStorage` | Until onboarding finish, sign-out, or session-expired cleanup |

`OnboardingRoute` requires `hasPendingSignup()` for guests without a user session.

Session-expired cleanup (`?reason=session_expired`): clears `tokenStore`, `pendingSignup`, `onboardingVerification`, and best-effort `authApi.logout()`.

## API endpoints

| User action | Frontend | Middleware (`/api/v1`) | Java (`/api`) |
|-------------|----------|------------------------|---------------|
| Create signup intent | `authApi.createSignupIntent` | `POST /auth/signup-intent` | `POST /auth/signup-intent` |
| Logout (session expired cleanup) | `authApi.logout` | `POST /auth/logout` | `POST /auth/logout` |

Signup-intent success: `{ signupIntentId, expiresAt }`. Duplicate email: HTTP 409 with generic message (surfaced as inline duplicate-email UI).

Legacy `POST /auth/onboarding/check-email` remains for compatibility but always returns `{ available: true }` to prevent email enumeration.

Actual registration (`POST /auth/signup`) is deferred to onboarding finish — see [onboarding/PAGE.md](../onboarding/PAGE.md).

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

    alt email already registered
        Java-->>Signup: 409 Conflict
        Signup->>Signup: show generic duplicate-email error alert
    else email available
        Java-->>Signup: { signupIntentId, expiresAt }
        Signup->>Storage: writePendingSignup({ signupIntentId, email, consents, name? })
        Signup->>Storage: writePendingGoogleConsents, writeAnalyticsConsent
        Signup->>Signup: navigate(/onboarding, replace)
    end
```

## Edge cases

- **Deferred account creation**: Closing the tab loses `pendingSignup`; user must restart from signup.
- **Duplicate email**: Shows a generic inline error; editing the email field clears the message.
- **Weak password**: Blocked client-side before any API call; server may return 400 with generic weak-password message.
- **Terms / AI consent not accepted**: Blocked client-side before signup-intent call; server rejects missing AI consent with 400.
- **Session expired on signup URL**: Wipes all signup handoff state; user re-enters form.
- **Logged-in user**: `GuestRoute` redirects away before form is usable.
- **reCAPTCHA**: When configured, required on signup-intent submit.
- **Legacy `/register`**: Permanent redirect to `/signup` in `App.tsx`.
- **No Google button on signup**: Google OAuth is available on `/login` only; consents collected on signup are reused via `pendingGoogleConsents`.

## Related docs

- [shared/auth-infrastructure.md](../shared/auth-infrastructure.md)
- [shared/route-guards.md](../shared/route-guards.md)
- [onboarding/PAGE.md](../onboarding/PAGE.md)
