# Route guards

All guards live in `frontend/src/components/ProtectedRoute.tsx` and wrap route groups in `frontend/src/App.tsx`.

## Guard types

| Guard | Routes | Allows | Redirects when blocked |
|-------|--------|--------|------------------------|
| None | `/`, `/get-started`, `/billing`, `/pricing`, legal pages, `*` | Everyone | — |
| `GuestRoute` | `/login`, `/signup`, `/forgot-password`, `/reset-password` | Guests only | Logged-in → `/dashboard` or `/onboarding` (or `from` path) |
| `OnboardingRoute` | `/onboarding` | Guests with pending signup OR signed-in non-onboarded | No pending signup → `/signup`; onboarded → `/dashboard` |
| `ProtectedRoute` | All app pages | Signed-in + onboarded | No user → `/login`; not onboarded → `/onboarding` |
| `AdminRoute` | `/admin/saas`, `/admin/experiments` | `user.role === 'ADMIN'` | No user → `/login`; non-admin → `/dashboard` + toast |

## Redirect decision tree

```mermaid
flowchart TD
    start[Request route] --> guest{Guest auth page?}
    guest -->|yes| hasUser{User logged in?}
    hasUser -->|yes| onboarded{onboarded?}
    onboarded -->|yes| dash[/dashboard or from path/]
    onboarded -->|no| onb[/onboarding/]
    hasUser -->|no| allowGuest[Render guest page]

    guest -->|no| onbRoute{Onboarding route?}
    onbRoute -->|yes| onbCheck{onboarded?}
    onbCheck -->|yes| dash2[/dashboard/]
    onbCheck -->|no| pending{pending signup or user?}
    pending -->|no| signup[/signup/]
    pending -->|yes| allowOnb[Render onboarding]

    onbRoute -->|no| admin{Admin route?}
    admin -->|yes| adminRole{role ADMIN?}
    adminRole -->|no| dash3[/dashboard/]
    adminRole -->|yes| allowAdmin[Render admin in AppShell]

    admin -->|no| protected{Protected route?}
    protected -->|yes| hasUser2{User?}
    hasUser2 -->|no| login[/login/]
    hasUser2 -->|yes| onbGate{onboarded?}
    onbGate -->|no| onb2[/onboarding/]
    onbGate -->|yes| allowApp[Render page]
```

## Full-width layout (no AppShell sidebar)

`ProtectedRoute` skips `AppShell` for these paths:

- `/onboarding`
- `/welcome`
- `/dashboard`
- `/account`
- `/jobs`, `/kanban` (redirects to `/jobs`)
- `/jobs/:id`

All other protected routes render inside `AppShell` (sidebar + top bar + notification bell).

## Legacy route aliases

| From | To |
|------|-----|
| `/register` | `/signup` |
| `/pricing` | `/billing` |
| `/kanban` | `/jobs` |
| `/legal/privacy` | `/privacy` |
| `/legal/terms` | `/terms` |
| `/legal/help` | `/help` |
| `/legal/accessibility` | `/accessibility` |
| `/reset-password` | `/forgot-password` (preserves `?email=`) |
| `/welcome` | `/dashboard?welcome=1` |

## Public auth paths

These paths are excluded from `from` redirect after login:

`/login`, `/signup`, `/register`, `/forgot-password`, `/reset-password`

## Loading state

All guards show `PageLoader` while `AuthContext.loading` is true.

## Billing RBAC (subscription API)

| Action | Who can do it | API signal |
|--------|---------------|------------|
| View subscription, usage, invoices | Any **active** org member | `GET /billing/subscription` always allowed when authenticated |
| Checkout, portal, cancel | Org **owner** or **admin** only | `canManageBilling: true` in subscription response; mutations return 403 otherwise |
| Stripe portal / payment method | Owner/admin **and** `hasBillingAccount: true` (Stripe customer exists) | UI gates portal buttons on both flags |

Multi-org users: billing resolves `users.primary_billing_organization_id` when set and the user is an active member; otherwise falls back to the first owned org membership.

## Plan limits (API enforcement, not route guards)

Frontend route guards (`ProtectedRoute`, etc.) do **not** block navigation when a plan limit is exceeded. Limits are enforced on the **Java API** via `@PlanGated` + `PlanEnforcementService`:

| Mechanism | Behavior |
|-----------|----------|
| `PlanGatingAspect` | Intercepts `@PlanGated` controller methods before execution |
| `PlanEnforcementService` | Compares org usage vs `PlanLimit.forPlan(effectivePlan)` |
| Over limit | HTTP **402 Payment Required** with `PlanLimitErrorResponse` (`error: PLAN_LIMIT_EXCEEDED`, `feature`, `currentPlan`, `upgradeUrl`) |
| Frontend UX | `api.ts` intercepts 402 → `emitPlanLimitExceeded` → `PlanLimitBanner` in `App.tsx` |
| Dev/test bypass | `dev`/`test` Spring profiles skip enforcement unless `SAAS_BILLING_ENFORCEMENT_ENABLED=true` |

Gated features include `ai_skill_run`, `cv_upload`, `job_application`, and team invites (`team_member` via `OrgService`).

Users can always open protected pages; hitting a gated action (e.g. run skill, upload CV, auto-apply) triggers the 402 + upgrade banner — not a route redirect.
