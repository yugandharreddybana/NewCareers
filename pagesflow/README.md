# Pagesflow

Per-page documentation for the CareerOps frontend. Each folder contains `PAGE.md` — route, guards, fields (required vs optional), user actions, API flow, file map, and sequence diagram.

## How to use

1. Copy [_TEMPLATE.md](./_TEMPLATE.md) when documenting a new page.
2. Configure the stack via [mandatory-fields.md](./mandatory-fields.md) (env vars, API keys, file placement).
3. Cross-cutting docs in [shared/](./shared/):
   - [auth-infrastructure.md](./shared/auth-infrastructure.md) — cookies, refresh, axios, HMAC
   - [route-guards.md](./shared/route-guards.md) — GuestRoute, ProtectedRoute, redirects
   - [gdpr-data-storage.md](./shared/gdpr-data-storage.md) — PostgreSQL schema, encryption, consent, retention, erasure (June 2026)
4. Internal GDPR summary: [docs/GDPR.md](../docs/GDPR.md)

## Diagram legend

- Solid arrows in sequence diagrams = requests / calls
- Return arrows = responses
- `alt` blocks = conditional branches (remember me, captcha, errors)

## Maintenance — keep docs in sync

When you change a page or its direct components, update the matching `pagesflow/<folder>/PAGE.md` in the same change.

| Code | Docs folder |
|------|-------------|
| `frontend/src/pages/Login.tsx` | `pagesflow/login/` |
| `frontend/src/pages/AccountSettings.tsx` | `pagesflow/account-settings/` |
| `frontend/src/components/gdpr/PrivacySettingsSection.tsx` | `pagesflow/account-settings/` + `shared/gdpr-data-storage.md` |
| `backend/.../service/SkillService.java` | `pagesflow/skills/`, `pagesflow/job-detail/` |
| `backend/.../UserConsentController.java` | `pagesflow/account-settings/`, `docs/GDPR.md` |
| `frontend/src/components/auth/*` | Auth pages (`login`, `signup`, `forgot-password`) |
| `frontend/src/components/onboarding/*` | `pagesflow/onboarding/` |

Full route → folder mapping is in the index below. Env var changes also require [`mandatory-fields.md`](./mandatory-fields.md).

Cursor rule: [`.cursor/rules/pagesflow-sync.mdc`](../.cursor/rules/pagesflow-sync.mdc) auto-reminds when editing page files.

---

## Page index

### Public (no auth)

| Folder | Route | Guard | Summary |
|--------|-------|-------|---------|
| [home](./home/PAGE.md) | `/` | none | Marketing landing — hero, features, signup CTAs |
| [get-started](./get-started/PAGE.md) | `/get-started` | none | Candidate vs employer path picker |
| [privacy](./privacy/PAGE.md) | `/privacy` | none | Privacy policy (static legal) |
| [terms](./terms/PAGE.md) | `/terms` | none | Terms of service (static legal) |
| [help](./help/PAGE.md) | `/help` | none | Help center |
| [accessibility](./accessibility/PAGE.md) | `/accessibility` | none | Accessibility statement |
| [not-found](./not-found/PAGE.md) | `*` | none | Catch-all 404 (no AppShell) |

### Auth and onboarding

| Folder | Route | Guard | Summary |
|--------|-------|-------|---------|
| [login](./login/PAGE.md) | `/login` | `GuestRoute` | Email/password + Google; jumbled word CAPTCHA below password; Remember Me |
| [signup](./signup/PAGE.md) | `/signup` | `GuestRoute` | Deferred signup — stores pending credentials, no account yet |
| [onboarding](./onboarding/PAGE.md) | `/onboarding` | `OnboardingRoute` | 3-step profile setup, email OTP, CV parse, job delivery |
| [forgot-password](./forgot-password/PAGE.md) | `/forgot-password` | `GuestRoute` | Email → OTP → new password |
| [reset-password](./reset-password/PAGE.md) | `/reset-password` | `GuestRoute` | Legacy redirect → `/forgot-password` |
| [welcome](./welcome/PAGE.md) | `/welcome` | `ProtectedRoute` | Legacy redirect → `/dashboard?welcome=1` |

### Core app (protected)

| Folder | Route | Guard | Layout | Summary |
|--------|-------|-------|--------|---------|
| [dashboard](./dashboard/PAGE.md) | `/dashboard` | `ProtectedRoute` | full-width | Home dashboard — jobs, welcome, analytics widgets |
| [account-settings](./account-settings/PAGE.md) | `/account` | `ProtectedRoute` | full-width | Profile settings, CV, privacy/GDPR |
| [notifications](./notifications/PAGE.md) | *(TopBar)* | `ProtectedRoute` | AppShell | Bell + drawer — not a standalone route |
| [profile](./profile/PAGE.md) | `/profile` | `ProtectedRoute` | AppShell | Public-facing profile view |
| [pipeline](./pipeline/PAGE.md) | `/pipeline` | `ProtectedRoute` | AppShell | Job pipeline dashboard |
| [jobs](./jobs/PAGE.md) | `/jobs` | `ProtectedRoute` | full-width | Kanban job board |
| [job-detail](./job-detail/PAGE.md) | `/jobs/:id` | `ProtectedRoute` | full-width | Single job view + skills actions |

### Feature pages (protected + AppShell)

| Folder | Route | Summary |
|--------|-------|---------|
| [interviews](./interviews/PAGE.md) | `/interviews` | Interview history list |
| [interview](./interview/PAGE.md) | `/interview` | Live interview kit / mock interview (`?jobId=`) |
| [networking](./networking/PAGE.md) | `/networking` | Networking contacts |
| [workspaces](./workspaces/PAGE.md) | `/workspaces` | Job search workspaces |
| [progress](./progress/PAGE.md) | `/progress` | Application progress tracking |
| [cv-manager](./cv-manager/PAGE.md) | `/cv` | CV upload and management |
| [skills](./skills/PAGE.md) | `/skills` | AI career skills runner |
| [analytics](./analytics/PAGE.md) | `/analytics` | User analytics + permit intelligence |
| [billing](./billing/PAGE.md) | `/billing` | Subscription / billing UI |
| [refer](./refer/PAGE.md) | `/refer` | Referral program |
| [planner](./planner/PAGE.md) | `/planner` | Application planner / tasks |
| [auto-apply](./auto-apply/PAGE.md) | `/auto-apply` | Auto-apply feature |
| [watchlists](./watchlists/PAGE.md) | `/watchlists` | Job watchlists |
| [outreach](./outreach/PAGE.md) | `/outreach` | Outreach campaigns |
| [agent-memory](./agent-memory/PAGE.md) | `/agent-memory` | Agent memory browser |
| [resume-versions](./resume-versions/PAGE.md) | `/resume-versions` | Tailored resume versions |

### Admin

| Folder | Route | Guard | Summary |
|--------|-------|-------|---------|
| [admin-experiments](./admin-experiments/PAGE.md) | `/admin/experiments` | `AdminRoute` | A/B experiment dashboard |

---

## Orphan pages (no route in App.tsx)

| Source file | Notes |
|-------------|-------|
| `frontend/src/pages/HowItWorksPage.tsx` | Product explainer — not routed |
| `frontend/src/pages/PasswordRecovery.tsx` | Deprecated shim — use forgot/reset routes |

## Legacy redirects

| From | To |
|------|-----|
| `/register` | `/signup` |
| `/kanban` | `/jobs` |
| `/legal/privacy` | `/privacy` |
| `/legal/terms` | `/terms` |
| `/legal/help` | `/help` |
| `/legal/accessibility` | `/accessibility` |
| `/reset-password` | `/forgot-password` (preserves `?email=`) |
| `/welcome` | `/dashboard?welcome=1` |

**Broken links (404):** `/employers` (Home), `/sales` (Get Started footer).

## Shared files (not pages)

| Path | Purpose |
|------|---------|
| [shared/](./shared/) | Auth infrastructure, route guards, GDPR data storage |
| [_TEMPLATE.md](./_TEMPLATE.md) | PAGE.md scaffold |
| [mandatory-fields.md](./mandatory-fields.md) | Required env vars, API keys, file placement for dev/prod |
