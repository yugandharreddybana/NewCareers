# SaaS Admin Dashboard

## Overview

Admin-only SaaS operations dashboard. Live metrics (users, MRR, churn, trial conversions), paginated subscription list with plan override, feature-flag toggles, and top-20 AI usage by org for the current month. Requires `user.role === 'ADMIN'` via `AdminRoute`; sidebar **Admin** section links here and to Experiments.

## Route

| Property | Value |
|----------|-------|
| URL | `/admin/saas` |
| Guard | `AdminRoute` |
| Layout | `AppShell` |
| Redirects | — |

## Fields and inputs

| Field | Required | Validation | When shown |
|-------|----------|------------|------------|
| Subscription search | No | Free text; Enter to apply | Subscriptions section |
| Plan filter | No | `FREE` \| `PRO` \| `ENTERPRISE` | Subscriptions section |
| Status filter | No | `ACTIVE` \| `TRIALING` \| `PAST_DUE` \| `CANCELLED` | Subscriptions section |
| Override plan | Yes (modal) | Plan enum | Per subscription row |
| Feature flag toggle | — | POST toggle | Feature flags list |

## Actions

| Action | Trigger | Result |
|--------|---------|--------|
| Load dashboard | Page mount | Parallel React Query fetches for metrics, subscriptions, flags, AI usage |
| Refresh | Header button | Invalidates all `admin-saas` queries |
| Filter subscriptions | Plan/status/search | `GET /admin/saas/subscriptions` with query params |
| Paginate | Previous/Next | Updates `page` param |
| Override plan | Modal Save | `POST /admin/saas/subscriptions/{orgId}/override-plan` |
| Toggle flag | Switch click | `POST /admin/saas/feature-flags/{id}/toggle` (optimistic UI) |

## Auth and session

- Requires authenticated session with `ADMIN` role (`AuthContext.isAdmin`).
- Unauthenticated → `/login` with `state.from`.
- Authenticated non-admin → `/dashboard` + toast.
- Backend: `@PreAuthorize("hasRole('ADMIN')")` on all Java endpoints.
- Middleware: `authGuard` + `requireRole('ADMIN')`.

## API endpoints

| User action | Frontend | Middleware (`/api/v1`) | Java (`/api`) |
|-------------|----------|------------------------|---------------|
| Metrics | `saasAdminApi.getMetrics()` | `GET /admin/saas/metrics` | `GET /admin/saas/metrics` |
| List subscriptions | `saasAdminApi.listSubscriptions()` | `GET /admin/saas/subscriptions` | same |
| Override plan | `saasAdminApi.overridePlan()` | `POST /admin/saas/subscriptions/:orgId/override-plan` | same |
| Feature flags | `saasAdminApi.listFeatureFlags()` | `GET /admin/saas/feature-flags` | same |
| Toggle flag | `saasAdminApi.toggleFeatureFlag()` | `POST /admin/saas/feature-flags/:id/toggle` | same |
| AI usage | `saasAdminApi.getAiUsage()` | `GET /admin/saas/ai-usage` | same |

MRR uses config prices: `saas.billing.price.*` (default FREE=0, PRO=19, ENTERPRISE=299).

## File map

### Frontend

| Role | Path |
|------|------|
| Page | `frontend/src/pages/admin/SaasDashboard.tsx` |
| API | `frontend/src/services/saasAdminApi.ts` |
| Nav | `frontend/src/components/layout/Sidebar.tsx` (Admin group) |
| Auth | `frontend/src/context/AuthContext.tsx` (`isAdmin`) |

### Middleware

| Role | Path |
|------|------|
| Routes | `middleware/src/routes/admin-saas.routes.ts` |
| Mount | `middleware/src/server.ts` → `/api/v1/admin/saas` |

### Backend

| Role | Path |
|------|------|
| Controller | `backend/.../controller/AdminSaasController.java` |
| Service | `backend/.../service/AdminSaasService.java` |
| DTOs | `backend/.../dto/AdminSaasDtos.java` |
| MRR config | `backend/.../config/SaasBillingProperties.java` |

## Related admin routes

| Route | Page doc |
|-------|----------|
| `/admin/experiments` | [admin-experiments/PAGE.md](../admin-experiments/PAGE.md) |
