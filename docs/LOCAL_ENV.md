# Local environment setup

## Quick start (recommended)

Uses a **file-backed H2** database on Java port **8100** (default path `%USERPROFILE%\.careerops\db\` on Windows, `~/.careerops/db/` on macOS/Linux) so accounts and jobs **survive backend restarts**. One canonical mock job is seeded on first DB creation only.

```bash
# Terminal 1 — Java (default `test` profile)
cd backend
mvn spring-boot:run
# Tests are skipped by default (backend `run` Maven profile). Run tests explicitly:
# mvn test -Dmaven.test.skip=false -DskipTests=false

# Terminal 2 — middleware
cd middleware
cp .env.example .env   # if you do not already have .env
npm install && npm run dev

# Terminal 3 — frontend
cd frontend
npm install && npm run dev
# Or: npm run dev:stack from frontend/ (Vite + middleware together)
```

Open http://localhost:5173 — the dashboard should show seeded jobs without calling fetch.

### Local database persistence

| Topic | Detail |
|-------|--------|
| Default DB file | `${user.home}/.careerops/db/careerops.mv.db` |
| Override path | Set `H2_DATABASE_PATH` to a folder (no `.mv.db` suffix), e.g. `H2_DATABASE_PATH=D:/Career/careerops-db` before `mvn spring-boot:run` |
| Reset local data | Stop Java, delete the `.mv.db` / `.trace.db` files in that folder, restart (schema + dev seed recreated) |
| Seeded dev login | `dev@careerops.ie` / `password` — H2 on first DB create; Postgres after Flyway **V110** (restart Java once) |

If you previously ran the backend when it used **in-memory** H2, that data is gone — register again once, or use the seeded dev account above.

## Port & URL matrix

| Service    | URL | Notes |
|-----------|-----|--------|
| Frontend  | http://localhost:5173 | Do **not** set `VITE_API_URL=http://localhost:4000` in dev |
| Middleware| http://localhost:4000 | Public API is `/api/v1/*`; proxies to Java `/api/*` |
| Java `test` profile | http://localhost:8100/api | H2 file DB; controllers at `/jobs`, `/auth`, … |
| Java `dev` profile  | http://localhost:8080/api | Postgres; set `JAVA_BACKEND_URL` to this base |

## Files to configure

| File | Purpose |
|------|---------|
| `middleware/.env` | `JAVA_BACKEND_URL`, `APP_INTERNAL_SECRET`, `JWT_PUBLIC_KEY`, Stripe placeholders |
| Repo root `.env` | Java secrets: `APP_INTERNAL_SECRET`, `APP_MASTER_KEK`, `JWT_*_PEM`, `DATABASE_PASSWORD` |
| `frontend/.env` or `.env.development` | `VITE_DEV_BYPASS_GUARDS=false` (keep off); leave API URL unset |
| `middleware/.env` | `DEV_AUTO_AUTH=true` only if you need API calls without logging in |
| `frontend/.env.local` | `VITE_GOOGLE_CLIENT_ID` — same Web client ID as Java `GOOGLE_OAUTH_CLIENT_ID` |
| `backend/.../application.properties` | Non-secret defaults only — **never** put API keys or passwords here |
| Repo root `.env` | Gitignored; loaded via `spring.config.import` when running Java from `backend/` |
| `APP_MASTER_KEK` | Java env — **required** for boot (except `test` profile). Base64-encoded 256-bit AES key: `openssl rand -base64 32`. Wraps per-user DEKs in `careerops.user_keys`. |
| `APP_ENCRYPTION_KEY` | Java env — optional legacy global key. Lazy decrypt fallback for ciphertext written before per-user DEKs; new writes use per-user keys. |

### Google Sign-In

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Create OAuth client ID** → **Web application**.
2. **Authorized JavaScript origins:** `http://localhost:5173` (and your production URL).
3. Copy the Client ID into:
   - `VITE_GOOGLE_CLIENT_ID` in `frontend/.env.local`
   - `GOOGLE_OAUTH_CLIENT_ID` in the environment when starting Java (or repo `.env`)
4. Restart **backend** and **frontend** after setting both values.

### Password reset email (Resend)

OTP emails use [Resend](https://resend.com/). By default `resend.dev-mode=true` logs the code to the Java console instead of sending mail.

| Variable | Where | Purpose |
|----------|-------|---------|
| `RESEND_API_KEY` | Java `application.properties` or env | Resend API key for live sends |
| `RESEND_FROM` | Java — e.g. `NewCareers <noreply@yourdomain.com>` | Verified sender domain |
| `RESEND_DEV_MODE` | Java — set `false` for real email | When `true`, OTP is logged only |
| `APP_BASE_URL` | Java — e.g. `http://localhost:5173` | Links in password-reset emails |

For local testing with real inbox delivery: set `RESEND_API_KEY`, `RESEND_DEV_MODE=false`, and `APP_BASE_URL=http://localhost:5173`, then restart Java.

### Login CAPTCHA (built-in jumbled words)

Email/password login uses a server-issued jumbled character challenge below the password field. **No Google reCAPTCHA keys required for login.**

Flow: `GET /api/v1/auth/captcha/challenge` → user types characters → login sends `captchaToken` as `challengeId:answer`.

### Google reCAPTCHA (onboarding email verify only)

Optional — only needed for the onboarding email verification modal.

| Variable | File | Purpose |
|----------|------|---------|
| `VITE_RECAPTCHA_SITE_KEY` | `frontend/.env.local` | Public site key |
| `captcha.secret` | Repo root `.env` | Secret key (Java loads `../.env`) |

Create at [Google reCAPTCHA admin](https://www.google.com/recaptcha/admin) (v2 checkbox). Restart frontend and backend after setting.

### Remember me

When checked at login, the middleware stores the refresh token in an HttpOnly `co_refresh` cookie (30 days). Unchecked uses a session cookie cleared when the browser closes. Access tokens use a 15-minute `co_session` cookie and are silently refreshed via `/auth/refresh`.

No extra env vars — ensure middleware and frontend both run with `withCredentials` (default).

## Secrets that must match

`APP_INTERNAL_SECRET` in **both** repo-root `.env` (Java) and `middleware/.env` **must be identical** (≥32 characters; generate with `openssl rand -hex 32`).

`INTERNAL_TRUST_SECRET` is a deprecated alias in middleware only — prefer `APP_INTERNAL_SECRET`.

Middleware signs every Java hop with `X-Timestamp` + `X-Signature` (HMAC-SHA256).

**Never store secret values in committed `application*.properties` files.** Local dev uses gitignored `.env`; production uses platform env injection and/or AWS Secrets Manager (`prod` profile).

`JWT_PUBLIC_KEY` in middleware must match the Java RS256 public key (`JWT_PUBLIC_KEY_PEM` or legacy `jwt.public-key`).

**JWKS (third-party token verification):**

| URL | Role |
|-----|------|
| `http://localhost:4000/.well-known/jwks.json` | Public (middleware proxy) |
| `http://localhost:8080/api/.well-known/jwks.json` | Java backend direct |

Generate a 2048-bit RSA pair for production:

```bash
openssl genrsa -out private.pem 2048
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.pem -out private-pkcs8.pem
openssl rsa -in private.pem -pubout -out public.pem
```

Set `JWT_PRIVATE_KEY_PEM` and `JWT_PUBLIC_KEY_PEM` in repo `.env` (Java loads `../.env` when run from `backend/`).

## AI job matching (NVIDIA NIM)

Onboarding and job scoring call NVIDIA NIM. Without a key you still get scraped jobs, but match scores use a heuristic fallback (`AI engine not configured (NVIDIA NIM)` in Java logs).

1. Create a free API key at [build.nvidia.com](https://build.nvidia.com).
2. Copy `.env.example` to repo root `.env` and set `NVIDIA_API_KEY`. The backend loads `../.env` automatically when you run `mvn spring-boot:run` from `backend/`.
3. Restart the backend after setting the key.

Optional: `NVIDIA_MAX_CONCURRENT=2` (default) limits parallel scoring during onboarding.

## Adzuna (optional, more IE listings)

```bash
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
```

Register at [developer.adzuna.com](https://developer.adzuna.com/). Without these, Adzuna is skipped; IrishJobs, Jobs.ie, LinkedIn public, Remotive, and other sources still run.

## GDPR & consent (local dev)

| Topic | Detail |
|-------|--------|
| Consent API | `GET/POST /api/v1/consents` — requires login; records append-only rows in `user_consents` |
| Data export | `GET /api/v1/account/export` — downloadable `my-data.json`; logs `DATA_EXPORT_REQUESTED` |
| Account delete | `DELETE /api/v1/account` — immediate anonymization; password or Google `idToken` re-auth |
| Cookie banner | Shown until analytics choice is stored in `localStorage`; gates Sentry init |
| Sentry | Set `VITE_SENTRY_DSN` only when testing monitoring; init runs after **ANALYTICS** consent |
| AI processing | Blocked server-side without `AI_PROCESSING` consent — enable in Account → Privacy & data |
| Retention cron | Daily **03:00** Dublin — `GDPR_RETENTION_CLEANUP` purges audit logs (12mo), password resets (30d), expired refresh tokens, and consents for users deleted 30d+ ago; fetch logs prune at **03:15** |
| Encryption at rest | Supabase: **Encrypt at Rest** on by default. Flyway enables `pgcrypto`. App-layer: per-user DEKs wrapped by `APP_MASTER_KEK`; legacy `APP_ENCRYPTION_KEY` decrypts old rows until re-written. Self-hosted Postgres: use TDE or encrypted volumes (e.g. AWS EBS). Full detail: [`docs/GDPR.md`](GDPR.md) — Encryption at rest. |
| Internal reference | [`docs/GDPR.md`](GDPR.md) |

Signup collects terms (required) and optional AI / marketing / analytics checkboxes. Deferred email signup sends consents on onboarding finish; Google signup passes consents on first `POST /auth/google`.

## Onboarding: Complete profile → account → job fetch

New candidates use **deferred signup**: `/signup` stores a server-side signup intent id, email, consents, and client expiry in the browser tab (`sessionStorage`), never the plaintext password. `/onboarding` collects the profile. **Complete profile** (step 3) runs this order:

1. `POST /api/v1/auth/signup` — create account and session (skipped if already logged in)
2. `PUT /api/v1/profile` with `onboarded: true`
3. `POST /api/v1/profile/cv/upload` (or equivalent CV upload route)
4. `POST /api/v1/onboarding/delivery/start` — scrape job boards and AI-evaluate matches (not the dashboard **Fetch jobs** button)

Verify in DevTools → Network after clicking **Complete profile**: the four calls above appear in that order, then polling `GET /api/v1/onboarding/delivery/status` until `ready` or `ready_partial`.

Implementation: [`frontend/src/lib/completeOnboardingFinish.ts`](../frontend/src/lib/completeOnboardingFinish.ts), orchestrated from [`frontend/src/pages/Onboarding.tsx`](../frontend/src/pages/Onboarding.tsx).

## Loading more jobs

Seeded jobs appear automatically in `test` profile. For live listings:

1. Complete onboarding in the UI (or use dev user with seeded profile).
2. Click **Fetch jobs** on the dashboard (`POST /api/v1/jobs/fetch`).
3. For a profile-ranked live Adzuna role, use **Fetch live Adzuna match** (`POST /api/v1/jobs/fetch-adzuna-live`) when Adzuna keys are set.

## Verify jobs API

```bash
curl http://localhost:4000/api/v1/jobs
```

Expect HTTP 200 and `"items":[...]` with one TechWave Ireland entry after Java restart with `test` profile.

## Canonical mock job

Single source of truth: [`shared/canonical-mock-job.json`](../shared/canonical-mock-job.json)

| Layer | Location |
|-------|----------|
| API seed (H2 `test` profile) | `backend/src/main/resources/h2-dev-seed.sql` |
| Vitest / MSW | `frontend/src/test/canonicalMockJob.ts` → imports JSON |

Stable IDs: user `00000000-0000-0000-0000-000000000001`, job `cccccccc-cccc-cccc-cccc-ccccccccccc1`, user-job `dddddddd-dddd-dddd-dddd-ddddddddddd1`.
