# Section 13 — QA Checklist

> Status: **In Progress**  
> Scope: e2e flows · security audit · mobile 375px · desktop 1280px

---

## ✅ Code Fixes Applied (this commit)

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `Navbar.tsx` | `logout` called on `useAuth()` — **does not exist** (crashes sign-out on desktop) | Renamed to `signOut` to match `AuthContext` export |
| 2 | `Navbar.tsx` | `/billing` and `/account` pages had no entry point from desktop UI | Added avatar dropdown menu with Billing, Account Settings, Profile links |
| 3 | `PageShell.tsx` | Hard-coded `slate-*` Tailwind classes instead of design tokens (`text-text-primary`, `bg-border`) | Replaced all with design tokens; added `aria-hidden` on divider |
| 4 | `AppShell.tsx` | Hard-coded `bg-slate-100`, `border-slate-200`; no iOS safe-area side insets | Replaced with tokens; added `safe-area-inset-left/right` on `<main>` |
| 5 | `BottomNav.tsx` | Hard-coded `text-slate-400/600`, `border-slate-200`, `bg-emerald-500`; missing `aria-label`; Dashboard link matched `/dashboard/*` | All tokens applied; `aria-label` added; `end` prop added to Dashboard link |

---

## 🧪 e2e Flow Checklist

### Auth Flows
- [ ] Sign up → onboarding wizard → dashboard
- [ ] Log in → dashboard
- [ ] Forgot password → email → reset → login
- [ ] Sign out (desktop + mobile)

### Core App Flows
- [ ] Dashboard loads job cards; "Get More Jobs" triggers scrape
- [ ] Job Detail opens from card; all 6 skill buttons run
- [ ] Kanban drag-and-drop across all 6 columns
- [ ] Applied CV upload modal on Kanban
- [ ] Profile: edit preferences, upload CV, view stats
- [ ] CV Manager: upload, set primary, delete
- [ ] Skills Coach: run tool, view result
- [ ] Analytics: chart renders, no empty-state errors
- [ ] Refer page: copy link, view referral count
- [ ] Billing page: plan cards render, upgrade CTA disabled (no Stripe yet)
- [ ] Account Settings: name update, password change, data export, delete flow (confirm gate)

---

## 🔒 Security Audit Checklist

- [ ] All `/api/*` routes require valid JWT (401 if missing/expired)
- [ ] Rate limiter active on `/auth/login` and `/auth/register` (100 req/15min)
- [ ] CORS origin restricted to `FRONTEND_URL` env var in production
- [ ] RLS enabled on all Supabase tables (no anon read/write)
- [ ] CV storage bucket is private (no public URL access)
- [ ] Refresh token rotation works (old token rejected after refresh)
- [ ] `HttpOnly` cookie or `tokenStore` — tokens not exposed to `document.cookie`
- [ ] Helmet.js headers present (`X-Frame-Options`, `X-Content-Type-Options`, `HSTS`)
- [ ] No secrets committed to repo (`.env` in `.gitignore`)

---

## 📱 Responsive Checklist

### Mobile — 375px (iPhone SE)
- [ ] Auth screens: no horizontal overflow
- [ ] Onboarding wizard: all steps fit, tag inputs usable
- [ ] Dashboard: job cards stack correctly, counter visible
- [ ] Job Detail: skill buttons wrap cleanly, match circle centred
- [ ] Kanban: horizontal scroll works, column headers visible
- [ ] Profile: all sections visible, CV upload tap target ≥ 44px
- [ ] Bottom nav: 5 items fit, active dot + label visible, safe-area respected
- [ ] Modals: full-width, close button reachable

### Desktop — 1280px
- [ ] Sidebar collapses/expands, all nav links work
- [ ] Navbar avatar dropdown: Billing + Account Settings accessible
- [ ] Dashboard: job cards in grid, counter in top-right
- [ ] Kanban: all 6 columns visible in one row
- [ ] Profile: two-column layout
- [ ] Analytics: charts fill container without overflow

---

## 🚫 Explicitly Out of Scope (Section 13)

- Stripe billing integration — deferred
- Push notifications
- E2E test automation (Playwright/Cypress) — manual QA only at this stage
