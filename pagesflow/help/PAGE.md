# Help

## Overview

Static help center with self-service pointers for account privacy, password reset, and Google account deletion. Public legal/support page wrapped in `LegalPageShell`. Accessible to everyone.

## Route

| Property | Value |
|----------|-------|
| URL | `/help` |
| Guard | none |
| Layout | standalone (`LegalPageShell`) |
| Redirects | `/legal/help` → `/help` (replace) |

## Fields and inputs

| Field | Required | Validation | When shown |
|-------|----------|------------|------------|
| — | — | — | Read-only content; support email mailto link only |

## Actions

| Action | Trigger | Result |
|--------|---------|--------|
| Contact support | Email link | Opens `mailto:` to `SUPPORT_EMAIL` |
| Brand home | Header logo | Navigate to `/` |
| Cross-legal nav | Header links | Navigate to `/privacy`, `/terms`, `/help`, `/accessibility` |
| Password reset (referenced) | Copy points users | Navigate to `/login` → Forgot password → `/forgot-password` |
| Account privacy (referenced) | Copy points users | Protected `/account` (requires login) |

## Auth and session

N/A — public static page. Some guidance references protected account settings.

## API endpoints

| User action | Frontend | Middleware (`/api/v1`) | Java (`/api`) |
|-------------|----------|------------------------|---------------|
| — | — | — | No API calls on this page |

## File map

### Frontend

| Role | Path |
|------|------|
| Page | `frontend/src/pages/legal/HelpPage.tsx` |
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
    participant HelpPage
    participant LegalPageShell

    User->>HelpPage: GET /help
    HelpPage->>LegalPageShell: render title + help bullets
    LegalPageShell-->>User: static help content
```

## Edge cases

- Password reset flow lives on `GuestRoute` pages (`/forgot-password`, `/reset-password`), not on this page.
- Legacy `/legal/help` alias preserved for old bookmarks.
- Linked from Home footer as "Help Center".

## Related docs

- [shared/auth-infrastructure.md](../shared/auth-infrastructure.md)
- [shared/route-guards.md](../shared/route-guards.md)
