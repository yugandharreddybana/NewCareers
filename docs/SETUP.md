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
cd career-ops/backend

# Copy and fill the properties file
cp src/main/resources/application.example.properties \
   src/main/resources/application.properties
```

Edit `application.properties` — replace every `YOUR_*` and `CHANGE_ME_*`:

```properties
spring.datasource.url=jdbc:postgresql://db.YOUR-PROJECT.supabase.co:5432/postgres
spring.datasource.password=YOUR_DB_PASSWORD
internal.trust.secret=some-long-random-string-keep-same-as-middleware
jwt.secret=same-32-char-string-as-middleware
gemini.api.key=AIza...
adzuna.app.id=abc123
adzuna.app.key=xyz789
reed.api.key=reed-key
resend.api.key=re_...
supabase.url=https://xyz.supabase.co
supabase.service.key=eyJ...
```

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
# Edit .env — fill JWT_SECRET (same as Java), INTERNAL_TRUST_SECRET (same as Java)

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

- [ ] Set `COOKIE_SECURE=true` and serve over HTTPS
- [ ] Set `COOKIE_SAMESITE=strict`
- [ ] Add `cors.allowed.origins` to your production frontend URL
- [ ] Use a secrets manager (Vault / AWS Secrets Manager) — never commit `.env` or `application.properties`
- [ ] Enable Supabase RLS policies (already enabled by `schema.sql`)
- [ ] Set `spring.jpa.hibernate.ddl-auto=none` in production
- [ ] Point Java cron timezone to `Europe/Dublin` (already set)
