# Playwright E2E

## Shared test profile

All suites use one credential (override with env vars):

| Field | Default |
|-------|---------|
| Email | `test@newcareer.com` |
| Password | `Test@1234` |

Constants live in [`helpers/auth.ts`](helpers/auth.ts) (`TEST_USER`).

## Lifecycle

- **globalSetup** — ensures the profile exists when middleware + Java are up
- **Non-signup specs** — `beforeAll(ensureTestUser)` before live API tests
- **Signup specs** — may create the profile during the file; `afterAll(deleteTestUser)` cleans up via `POST /account/delete`
- **Flyway V118** — seeds the profile in local Postgres as a fallback

## Prerequisites

```bash
# Terminal 1: middleware + Java backend
# Terminal 2: Vite on :5173
cd frontend && npm run test:e2e
```

## Config

- `workers: 1` — single shared account (avoid lockout / rate limits)
- `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` — optional overrides
