# Terms of Service

## Overview

Static terms of service for NewCareers accounts. Covers essential processing, AI feature consent requirements, and acceptable use. Public legal page wrapped in `LegalPageShell`. Accessible to everyone.

## Route

| Property | Value |
|----------|-------|
| URL | `/terms` |
| Guard | none |
| Layout | standalone (`LegalPageShell`) |
| Redirects | `/legal/terms` → `/terms` (replace) |

## Fields and inputs

| Field | Required | Validation | When shown |
|-------|----------|------------|------------|
| — | — | — | Read-only content |

## Actions

| Action | Trigger | Result |
|--------|---------|--------|
| Brand home | Header logo | Navigate to `/` |
| Cross-legal nav | Header links | Navigate to `/privacy`, `/terms`, `/help`, `/accessibility` |

## Auth and session

N/A — public static page. AI consent referenced in copy is enforced server-side for protected AI features after signup.

## API endpoints

| User action | Frontend | Middleware (`/api/v1`) | Java (`/api`) |
|-------------|----------|------------------------|---------------|
| — | — | — | No API calls on this page |

## File map

### Frontend

| Role | Path |
|------|------|
| Page | `frontend/src/pages/legal/TermsOfServicePage.tsx` |
| Shell | `frontend/src/pages/legal/LegalPageShell.tsx` |
| Components | `frontend/src/components/PageMeta.tsx` |
| Constants | `frontend/src/lib/brand.ts` (`legalPaths`) |

### Middleware

| Role | Path |
|------|------|
| Routes | — |

### Backend

| Role | Path |
|------|------|
| Controller | — |

## Sequence diagram

```mermaid
sequenceDiagram
    participant User
    participant TermsOfServicePage
    participant LegalPageShell

    User->>TermsOfServicePage: GET /terms
    TermsOfServicePage->>LegalPageShell: render title + static sections
    LegalPageShell-->>User: HTML terms content
```

## Edge cases

- Last updated date is hardcoded: June 2026.
- Legacy `/legal/terms` alias preserved for old bookmarks.

## Related docs

- [shared/auth-infrastructure.md](../shared/auth-infrastructure.md)
- [shared/route-guards.md](../shared/route-guards.md)
