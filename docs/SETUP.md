# CareerOps — Full Local Setup Guide

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Java | 17+ (LTS) | https://adoptium.net |
| Maven | 3.9+ (or use `./mvnw`) | bundled |
| Node.js | 20+ | https://nodejs.org |
| npm / pnpm | any | bundled with Node |

---

## Step 1 — Supabase

1. Create a free project at https://supabase.com
2. In **SQL Editor**, paste and run `db/schema.sql`
3. In **Storage**, create two **private** buckets:
   - `user-cvs`
   - `application-cvs`
4. Note your:
   - **Project URL** (`https://xyz.supabase.co`)
   - **Service Role key** (Settings → API → service_role)
   - **Database password** (set during project creation)
   - **DB host** (`db.xyz.supabase.co`)
5. **Encryption at rest:** Supabase enables **Encrypt at Rest** by default (no action needed). After Flyway runs, confirm `pgcrypto` is present (`SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'`). Set `APP_ENCRYPTION_KEY` for application-layer PII encryption (`openssl rand -base64 32`).

---

## Step 2 — API Keys (all free tiers)

| Service | URL | What you need |
|---------|-----|---------------|
| Google Gemini | https://aistudio.google.com/app/apikey | API key |
| Adzuna | https://developer.adzuna.com | app_id + app_key |
| Reed | https://www.reed.co.uk/developers/jobseeker | API key |
| Resend (email) | https://resend.com | API key |
| SerpAPI (optional) | https://serpapi.com | API key |

---

## Step 3 — Java Backend

```bash
cd career-ops

# Copy and fill secrets (gitignored — never commit)
cp .env.example .env
# Required: APP_INTERNAL_SECRET, APP_MASTER_KEK, JWT_PRIVATE_KEY_PEM, JWT_PUBLIC_KEY_PEM,
# DATABASE_URL, DATABASE_PASSWORD (and optional API keys)
```

Java loads repo-root `.env` automatically (`spring.config.import` in `application.properties`). Do **not** put secrets in `application.properties`.

Start the backend:
```bash
./mvnw spring-boot:run
# Listening on :8080
```

Test: `curl http://localhost:8080/health` → `{"ok":true}`

---

## Step 4 — Node Middleware

```bash
cd career-ops/middleware

cp .env.example .env
# Edit .env — fill JWT_PUBLIC_KEY (matches Java RS256 public key),
# APP_INTERNAL_SECRET (same as Java .env), and Stripe keys.
# JWKS for external integrators: GET http://localhost:4000/.well-known/jwks.json

npm install
npm run dev
# Listening on :4000
```

Test: `curl http://localhost:4000/health` → `{"ok":true}`

---

## Step 5 — React Frontend

```bash
cd career-ops/frontend

cp .env.example .env
# VITE_MIDDLEWARE_URL=http://localhost:4000 (no change needed for local dev)

npm install
npm run dev
# Vite listening on http://localhost:5173
```

Open http://localhost:5173 → Sign up → complete 3-step onboarding → dashboard loads.

---

## Running all three together

Open 3 terminals:

```
Terminal 1:  cd backend  && ./mvnw spring-boot:run
Terminal 2:  cd middleware && npm run dev
Terminal 3:  cd frontend  && npm run dev
```

---

## Architecture recap

```
Browser (React :5173)
   │  HTTPS / cookie
   ▼
Node Middleware (:4000)   ← JWT verified here, rate-limited here
   │  internal HTTP + trust headers
   ▼
Java Spring Boot (:8080)  ← all DB + Gemini calls happen here
   │
   ├── Supabase PostgreSQL (career_operations schema)
   ├── Supabase Storage    (user-cvs, application-cvs)
   └── Google Gemini API
```

**Security principles enforced:**
- Frontend has zero API keys — only `VITE_MIDDLEWARE_URL`
- JWT stored in HttpOnly cookie, never in localStorage
- Java trusts `userId` only from the internal Node header, never from the browser
- All DB queries are parameterised JPA (no raw SQL injection surface)
- CV files stored in private Supabase buckets, served only via signed time-limited URLs
- Daily 10-job limit enforced in Java, not the frontend

---

## Skill buttons quick reference

| Button | Endpoint | Prompt file |
|--------|----------|-------------|
| Full Evaluation | `POST /api/skills/evaluate` | `career-ops-skills/evaluate/SKILL.md` |
| Tailor My CV | `POST /api/skills/tailor-resume` | `career-ops-skills/tailor-resume/SKILL.md` |
| Research Company | `POST /api/skills/research` | `career-ops-skills/research/SKILL.md` |
| Draft Outreach | `POST /api/skills/outreach` | `career-ops-skills/outreach/SKILL.md` |
| Apply Assistant | `POST /api/skills/apply` | `career-ops-skills/apply/SKILL.md` |
| Prep Interview | `POST /api/skills/prep-interview` | `career-ops-skills/prep-interview/SKILL.md` |
| Compare All | `POST /api/skills/compare` | `career-ops-skills/compare/SKILL.md` |
| Triage All | `POST /api/skills/triage` | `career-ops-skills/triage/SKILL.md` |

To customise a skill's behaviour, edit the corresponding `SKILL.md` and restart the Java server (prompt is loaded at startup into an in-memory cache).

---

## Daily limit mechanics

| Slot | Who uses it | When |
|------|------------|------|
| 3 / day | Cron job (auto) | 08:00 Dublin time |
| 7 / day | "Get More Jobs" button | On demand |
| Total cap | 10 / day / user | Resets midnight UTC |

---

## Production checklist

### Encryption at rest

**Supabase (managed Postgres)**

- [ ] Confirm **Encrypt at Rest** under Project Settings → Infrastructure (enabled by default)
- [ ] After first backend boot and Flyway: `SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';`
- [ ] Set `APP_ENCRYPTION_KEY` in production (`openssl rand -base64 32`) for app-layer PII fields

**Self-hosted Postgres**

- [ ] Enable **Transparent Data Encryption (TDE)** if your distribution supports it, **or** encrypt underlying storage (AWS EBS, Azure Disk, LUKS)
- [ ] Run Flyway migrations (`pgcrypto` is enabled automatically in V64/V72)
- [ ] Set `APP_ENCRYPTION_KEY` the same as the Supabase path

Full detail: [`docs/GDPR.md`](GDPR.md) — Encryption at rest.

- [ ] Set `COOKIE_SECURE=true` and serve over HTTPS
- [ ] Set `COOKIE_SAMESITE=strict`
- [ ] Add `cors.allowed.origins` to your production frontend URL
- [ ] Use a secrets manager — never commit `.env` or secret values in `application.properties`
- [ ] **AWS Secrets Manager (optional):** create secret `careerops/prod` (or set `AWS_SECRETS_MANAGER_NAME`) with JSON keys matching env names (`APP_INTERNAL_SECRET`, `JWT_PRIVATE_KEY_PEM`, `APP_MASTER_KEK`, …); run with `SPRING_PROFILES_ACTIVE=prod` and IAM role allowing `secretsmanager:GetSecretValue`
- [ ] **HashiCorp Vault:** map secret paths to env vars at deploy time (no Spring Vault client in v1)
- [ ] Enable Supabase RLS policies (already enabled by `schema.sql`)
- [ ] Set `spring.jpa.hibernate.ddl-auto=none` in production
- [ ] Point Java cron timezone to `Europe/Dublin` (already set)
