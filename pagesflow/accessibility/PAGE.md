# Accessibility

## Overview

Static accessibility statement describing WCAG 2.1 Level AA goals and a contact channel for barrier reports. Public legal page wrapped in `LegalPageShell`. Accessible to everyone.

## Route

| Property | Value |
|----------|-------|
| URL | `/accessibility` |
| Guard | none |
| Layout | standalone (`LegalPageShell`) |
| Redirects | `/legal/accessibility` → `/accessibility` (replace) |

## Fields and inputs

| Field | Required | Validation | When shown |
|-------|----------|------------|------------|
| — | — | — | Read-only content; support email mailto link only |

## Actions

| Action | Trigger | Result |
|--------|---------|--------|
| Report barrier | Email link | Opens `mailto:` to `SUPPORT_EMAIL` |
| Brand home | Header logo | Navigate to `/` |
| Cross-legal nav | Header links | Navigate to `/privacy`, `/terms`, `/help`, `/accessibility` |

## Auth and session

N/A — public static page.

## API endpoints

| User action | Frontend | Middleware (`/api/v1`) | Java (`/api`) |
|-------------|----------|------------------------|---------------|
| — | — | — | No API calls on this page |

## File map

### Frontend

| Role | Path |
|------|------|
| Page | `frontend/src/pages/legal/AccessibilityPage.tsx` |
| Shell | `frontend/src/pages/legal/LegalPageShell.tsx` |
| Components | `frontend/src/components/PageMeta.tsx` |
| Constants | `frontend/src/lib/brand.ts` (`SUPPORT_EMAIL`, `legalPaths`) |

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
    participant AccessibilityPage
    participant LegalPageShell

    User->>AccessibilityPage: GET /accessibility
    AccessibilityPage->>LegalPageShell: render title + statement
    LegalPageShell-->>User: static accessibility content
```

## Edge cases

- Legacy `/legal/accessibility` alias preserved for old bookmarks.
- Linked from Home footer and `LegalPageShell` header nav.

## Related docs

- [shared/auth-infrastructure.md](../shared/auth-infrastructure.md)
- [shared/route-guards.md](../shared/route-guards.md)
