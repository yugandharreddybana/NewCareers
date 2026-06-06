# Mandatory fields to run the application

Production-ready env setup for **frontend**, **middleware**, and **backend**. Place secrets only in the files listed below — never commit filled `.env` files.

## Quick start commands

```bash
# 1. Repo root secrets (Java)
cp .env.example .env
# Edit .env — fill Required secrets section

# 2. Middleware
cd middleware
cp .env.example .env
# Set APP_INTERNAL_SECRET (match repo .env), JAVA_BACKEND_URL, JWT_PUBLIC_KEY

# 3. Frontend
cd frontend
cp .env.example .env.local
# Set VITE_GOOGLE_CLIENT_ID, VITE_RECAPTCHA_SITE_KEY (required for login captcha widget)

# 4. Run (three terminals)
cd backend && mvn spring-boot:run
cd middleware && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Or from `frontend/`: `npm run dev:stack` (Vite + middleware together).

---

## File placement matrix

| File | Used by | Dev | Production |
|------|---------|-----|------------|
| `.env` (repo root) | Java backend | Yes | Platform env / AWS Secrets Manager (`prod` profile) |
| `middleware/.env` | Express BFF | Yes | Platform env on middleware host |
| `frontend/.env.local` | Vite build | Yes | CI/CD build-time env (`VITE_*` only) |
| `backend/src/main/resources/application.properties` | Java defaults | Yes (non-secret defaults only) | Do not put secrets here |
| `scraper/.env` | Playwright scraper | Optional locally | If scraper deployed separately |

**Rule:** Secrets go in `.env` / `middleware/.env` / `frontend/.env.local` or production platform injection — never in committed properties files.

---

## Required — app will not boot or auth will fail without these

### Repo root `.env` (Java)

| Variable | How to get | Purpose |
|----------|------------|---------|
| `APP_INTERNAL_SECRET` | `openssl rand -hex 32` | HMAC middleware → Java; **must match** `middleware/.env` |
| `APP_MASTER_KEK` | `openssl rand -base64 32` | Wraps per-user encryption keys (required except `test` profile) |
| `JWT_PRIVATE_KEY_PEM` | `openssl genrsa 2048` → PKCS#8 PEM | RS256 signing |
| `JWT_PUBLIC_KEY_PEM` | `openssl rsa -pubout` from private key | RS256 verify; **must match** `middleware/.env` `JWT_PUBLIC_KEY` |
| `SPRING_DATASOURCE_URL` | Supabase → Database → Connection string | Postgres JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | Supabase dashboard | DB user |
| `SPRING_DATASOURCE_PASSWORD` | Supabase dashboard | DB password |

Aliases also accepted: `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` (see `application.properties`).

### `middleware/.env`

| Variable | How to get | Purpose |
|----------|------------|---------|
| `APP_INTERNAL_SECRET` | Same value as repo `.env` | HMAC signing |
| `JWT_PUBLIC_KEY` | Base64 SPKI from `JWT_PUBLIC_KEY_PEM` | Verify access tokens |
| `JAVA_BACKEND_URL` | `http://localhost:8080` (dev Postgres) or `http://localhost:8100` (test H2) | Proxy target |
| `ALLOWED_ORIGINS` | Your frontend origin(s) | CORS — e.g. `https://app.yourdomain.com` in prod |

### `frontend/.env.local`

| Variable | How to get | Purpose |
|----------|------------|---------|
| *(none strictly required for dev)* | Leave `VITE_API_URL` unset in dev | Uses Vite `/api` proxy to middleware |

Production frontend on separate origin:

| Variable | How to get | Purpose |
|----------|------------|---------|
| `VITE_API_URL` | Your middleware public URL | e.g. `https://api.yourdomain.com` |

---

## Required for full feature parity (strongly recommended)

### Authentication

| Variable | File | How to get |
|----------|------|------------|
| `GOOGLE_OAUTH_CLIENT_ID` | repo `.env` | [Google Cloud Console](https://console.cloud.google.com/) → Credentials → OAuth 2.0 Web client |
| `VITE_GOOGLE_CLIENT_ID` | `frontend/.env.local` | **Same value** as `GOOGLE_OAUTH_CLIENT_ID` |
| `VITE_RECAPTCHA_SITE_KEY` | `frontend/.env.local` | Optional — **onboarding email verify only** (not login) |
| `captcha.secret` | repo `.env` | Optional — pairs with `VITE_RECAPTCHA_SITE_KEY` for onboarding |

**Login CAPTCHA:** Built-in jumbled word challenge — no third-party keys. Server endpoint `GET /auth/captcha/challenge`; no extra env vars.

**Onboarding Google reCAPTCHA (optional):**

```env
# frontend/.env.local
VITE_RECAPTCHA_SITE_KEY=<site-key-from-recaptcha-admin>

# repo root .env
captcha.secret=<secret-key-from-recaptcha-admin>
```

Without Google client ID: email/password auth still works; Google button hidden.

### Email (password reset + onboarding OTP)

| Variable | File | How to get |
|----------|------|------------|
| `RESEND_API_KEY` | repo `.env` | [resend.com](https://resend.com) API key |
| `RESEND_FROM` | repo `.env` | Verified sender, e.g. `CareerOps <noreply@yourdomain.com>` |
| `RESEND_DEV_MODE` | repo `.env` | `true` = log OTP to console (dev); `false` = send real email |
| `APP_BASE_URL` | repo `.env` | Frontend URL for email links, e.g. `https://app.yourdomain.com` |

### AI job matching (onboarding delivery + skills)

| Variable | File | How to get |
|----------|------|------------|
| `NVIDIA_API_KEY` | repo `.env` | [build.nvidia.com](https://build.nvidia.com) → Get API Key |
| `NVIDIA_AGENT_MODEL` | repo `.env` | Optional; default `meta/llama-3.3-70b-instruct` |

Without NVIDIA key: jobs still scrape; match scores use heuristic fallback.

### Job sources (optional — more listings)

| Variable | File | How to get |
|----------|------|------------|
| `ADZUNA_APP_ID` | repo `.env` | [developer.adzuna.com](https://developer.adzuna.com/) |
| `ADZUNA_APP_KEY` | repo `.env` | Same |
| `REED_API_KEY` | repo `.env` | [reed.co.uk/developers](https://www.reed.co.uk/developers/jobseeker) |
| `SERPAPI_API_KEY` | repo `.env` | [serpapi.com](https://serpapi.com) — used inside AI skills for web search |

### CV storage (production)

| Variable | File | How to get |
|----------|------|------------|
| `SUPABASE_URL` | repo `.env` | Supabase → Settings → API |
| `SUPABASE_SERVICE_KEY` | repo `.env` | Service role key (server only) |

Without Supabase: CV parsed text saved to DB; file download may be limited.

### Billing (only if using `/billing`)

| Variable | File | How to get |
|----------|------|------------|
| `STRIPE_SECRET_KEY` | `middleware/.env` | Stripe Dashboard → API keys |
| `STRIPE_WEBHOOK_SECRET` | `middleware/.env` | Stripe webhook endpoint secret |

### Admin experiments page

| Variable | File | How to get |
|----------|------|------------|
| `APP_ADMIN_USER_IDS` | repo `.env` | Comma-separated user UUIDs from `users` table after first signup |

### Production hardening

| Variable | File | Purpose |
|----------|------|---------|
| `NODE_ENV` | `middleware/.env` | `production` |
| `COOKIE_SECURE` | `middleware/.env` | `true` behind HTTPS |
| `ALLOWED_ORIGINS` | `middleware/.env` | Exact production frontend origin(s) |
| `REDIS_URL` | `middleware/.env` | Distributed rate limiting (recommended prod) |
| `VITE_SENTRY_DSN` | `frontend/.env.local` | Error tracking (after analytics consent) |
| `VITE_POSTHOG_KEY` | `frontend/.env.local` | Analytics (optional) |

### Feature flags (frontend)

| Variable | File | Default |
|----------|------|---------|
| `VITE_FEATURE_AGENT_MEMORY` | `frontend/.env.local` | `false` |
| `VITE_FEATURE_AUTO_APPLY` | `frontend/.env.local` | `false` |
| `VITE_DEV_BYPASS_GUARDS` | `frontend/.env.local` | `false` — **never `true` in production** |

### Scraper (auto-started with backend by default)

| Variable | File | Purpose |
|----------|------|---------|
| `SCRAPER_BASE_URL` | repo `.env` | Default `http://127.0.0.1:5500` |
| `SCRAPER_AUTO_START` | repo `.env` | `true` = backend spawns scraper |

One-time setup: `cd scraper && pip install -r requirements.txt && playwright install chromium`

---

## Secrets that must match across services

| Secret | Java (`.env`) | Middleware (`middleware/.env`) | Frontend |
|--------|---------------|-------------------------------|----------|
| Internal HMAC | `APP_INTERNAL_SECRET` | `APP_INTERNAL_SECRET` | — |
| JWT public key | `JWT_PUBLIC_KEY_PEM` | `JWT_PUBLIC_KEY` (base64 SPKI) | — |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_ID` | — | `VITE_GOOGLE_CLIENT_ID` |
| reCAPTCHA | `captcha.secret` | — | `VITE_RECAPTCHA_SITE_KEY` |

---

## Dev vs production summary

| Concern | Development | Production |
|---------|-------------|------------|
| Frontend API | Leave `VITE_API_URL` unset; Vite proxies `/api` → `:4000` | Set `VITE_API_URL` to middleware public URL |
| Java port | `8080` (Postgres dev) or `8100` (H2 test) | Platform-assigned; set `JAVA_BACKEND_URL` accordingly |
| Cookies | `COOKIE_SECURE=false` | `COOKIE_SECURE=true`, HTTPS only |
| Email | `RESEND_DEV_MODE=true` logs OTP | `RESEND_DEV_MODE=false` + verified domain |
| DB | Local Postgres or Supabase | Managed Postgres (Supabase/RDS) |
| Secrets | Gitignored `.env` files | CI/CD + AWS Secrets Manager / platform env |

---

## Generate commands reference

```bash
# Internal secret
openssl rand -hex 32

# Master encryption key
openssl rand -base64 32

# JWT RSA keypair
openssl genrsa -out private.pem 2048
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.pem -out private-pkcs8.pem
openssl rsa -in private.pem -pubout -out public.pem
# Paste private-pkcs8.pem → JWT_PRIVATE_KEY_PEM
# Paste public.pem → JWT_PUBLIC_KEY_PEM
# Base64 SPKI for middleware JWT_PUBLIC_KEY — extract from public.pem or use project script
```

---

## Verify setup

```bash
# Middleware health + Java proxy
curl http://localhost:4000/api/v1/jobs

# JWKS
curl http://localhost:4000/.well-known/jwks.json

# Frontend
open http://localhost:5173
```

See also: [`docs/LOCAL_ENV.md`](../docs/LOCAL_ENV.md), [`.env.example`](../.env.example), [`middleware/.env.example`](../middleware/.env.example), [`frontend/.env.example`](../frontend/.env.example).
