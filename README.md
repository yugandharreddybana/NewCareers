# CareerOps / NewCareers

AI-powered career intelligence platform: job discovery, AI matching, Kanban pipeline, outreach, and interview coaching.

```
Browser (React + Vite)  →  http://localhost:5173
         ↓  /api proxy
Node middleware (Express)  →  http://localhost:4000
         ↓  internal HTTP + HMAC
Java Spring Boot  →  http://localhost:8100/api   (default local: H2)
```

---

## Table of contents

1. [Software you must install](#1-software-you-must-install)
2. [Clone the repo](#2-clone-the-repo)
3. [Recommended: first-time setup on any laptop](#3-recommended-first-time-setup-on-any-laptop)
4. [How to run the backend (Java)](#4-how-to-run-the-backend-java)
5. [How to run the Node middleware](#5-how-to-run-the-node-middleware)
6. [How to run the frontend](#6-how-to-run-the-frontend)
7. [Configuration files (what to create and what to set)](#7-configuration-files-what-to-create-and-what-to-set)
8. [Login credentials (local seed)](#8-login-credentials-local-seed)
9. [Optional API keys (jobs, AI, email, OAuth)](#9-optional-api-keys-jobs-ai-email-oauth)
10. [Postgres / production-like backend](#10-postgres--production-like-backend)
11. [Troubleshooting](#11-troubleshooting)
12. [Project structure](#12-project-structure)
13. [More documentation](#13-more-documentation)

---

## 1. Software you must install

| Software | Version | Why | How to check |
|----------|---------|-----|--------------|
| **Git** | any recent | Clone / push | `git --version` |
| **Node.js** | **20+** (LTS) | Frontend + middleware | `node -v` |
| **npm** | comes with Node | Install JS deps | `npm -v` |
| **JDK** | **21+** | Java backend | `java -version` |
| **Apache Maven** | **3.9+** | Build / run Spring Boot | `mvn -v` |
| **Python** | **3.11+** (optional) | Playwright job scraper sidecar | `python --version` |

**Not required for the default local stack**

| Software | When you need it |
|----------|------------------|
| PostgreSQL | Only if you run Spring profile `dev` / `prod` |
| Redis | Staging/prod rate limits; optional locally |
| Docker | Optional (compose files exist for prod-like runs) |

Install notes:

- **Windows:** install [Temurin or Microsoft JDK 21](https://adoptium.net/), [Maven](https://maven.apache.org/download.cgi), [Node 20 LTS](https://nodejs.org/). Add `java` and `mvn` to your `PATH`, then open a **new** terminal.
- **macOS:** `brew install openjdk@21 maven node` (link JDK into PATH as brew documents).
- **Linux:** use your distro packages or SDKMAN for JDK 21 + Maven; install Node 20 from NodeSource or nvm.

---

## 2. Clone the repo

```bash
git clone https://github.com/yugandharreddybana/NewCareers.git
cd NewCareers
```

---

## 3. Recommended: first-time setup on any laptop

This path uses the **`test` Spring profile**: file H2 database on port **8100**. No Postgres, no Redis, and **no filled root `.env` secrets** are required.

### Windows (PowerShell)

```powershell
# 1) Diagnose machine (Java, Maven, Node, middleware .env, port 8100)
.\scripts\doctor-local.ps1

# 2) One-time bootstrap (creates middleware/.env, H2 folder, optional scraper venv)
.\scripts\bootstrap-local.ps1

# 3) Terminal 1 — Java backend
.\scripts\start-backend.ps1

# 4) Terminal 2 — Node middleware
cd middleware
npm install
npm run dev

# 5) Terminal 3 — React frontend
cd ..\frontend
npm install
npm run dev
```

### macOS / Linux

```bash
chmod +x scripts/*.sh

./scripts/doctor-local.sh
./scripts/bootstrap-local.sh

# Terminal 1
./scripts/start-backend.sh

# Terminal 2
cd middleware && npm install && npm run dev

# Terminal 3
cd ../frontend && npm install && npm run dev
```

### Open the app

1. Wait until Java logs show `Started CareerOpsApplication` and `Tomcat started on port 8100`.
2. Confirm middleware is listening on **4000**.
3. Open **http://localhost:5173**
4. Log in with the seed account (see [§8](#8-login-credentials-local-seed)).

**Shortcut:** from `frontend/`, `npm run dev:stack` starts Vite **and** middleware together. You still need the Java backend running separately.

---

## 4. How to run the backend (Java)

### Default local (recommended) — H2 on port 8100

| Item | Value |
|------|--------|
| Spring profile | `test` (+ `cache`) |
| Port | **8100** |
| API base | `http://localhost:8100/api` |
| Health check | `http://localhost:8100/api/health` |
| Database | File H2 under `%USERPROFILE%\.careerops\db\` (Windows) or `~/.careerops/db/` |

**Ways to start**

```powershell
# Windows — preferred
.\scripts\start-backend.ps1
```

```bash
# Any OS — from backend/
cd backend
mvn spring-boot:run
# Defaults to SPRING_PROFILES_ACTIVE=test via application.properties
```

```bash
# Explicit profile
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=test
```

**VS Code / Cursor:** use launch config **“CareerOps Backend (H2 test :8100)”** in `.vscode/launch.json`.

**Do not** set `SPRING_PROFILES_ACTIVE=dev` unless Postgres and real secrets are configured — that is the usual reason a second machine fails to start.

### What you should see when it works

- Log line: `The following 2 profiles are active: "cache", "test"` (order may vary)
- `Tomcat started on port 8100`
- `GET http://127.0.0.1:8100/api/health` → `{"status":"UP",...}`

### Optional: scraper sidecar

Java can auto-start the Python scraper on port **5500** when a venv exists (`SCRAPER_AUTO_START=true`). Bootstrap installs it if Python is available. Without it, free HTTP job sources (Remotive, Jobicy, Arbeitnow, RemoteOK, etc.) still work.

---

## 5. How to run the Node middleware

The browser **never** talks to Java directly. The frontend calls the middleware; the middleware proxies to Java with HMAC signing.

| Item | Value |
|------|--------|
| Folder | `middleware/` |
| Port | **4000** |
| Public API | `http://localhost:4000/api/v1/...` |
| Config file | `middleware/.env` (copy from `middleware/.env.example`) |

```bash
cd middleware
cp .env.example .env          # first time only (Windows: Copy-Item .env.example .env)
npm install
npm run dev
```

### Critical middleware settings for local H2

Edit `middleware/.env` and ensure:

| Variable | Required local value | Why |
|----------|----------------------|-----|
| `JAVA_BACKEND_URL` | `http://localhost:8100` | Must match Java `test` port (**not** `8080`) |
| `APP_INTERNAL_SECRET` | `test-internal-trust-secret-minimum-32-characters-long` | Must match Java test default |
| `JWT_PUBLIC_KEY` | (keep value from `.env.example`) | Must match Java test JWT public key |
| `ALLOWED_ORIGINS` | includes `http://localhost:5173` | CORS for Vite |
| `PORT` | `4000` | Default |

`scripts/bootstrap-local.*` creates/fixes `JAVA_BACKEND_URL` and a blank `APP_INTERNAL_SECRET` for you.

---

## 6. How to run the frontend

| Item | Value |
|------|--------|
| Folder | `frontend/` |
| Dev URL | **http://localhost:5173** |
| Config | `frontend/.env.local` (optional; copy from `frontend/.env.example`) |

```bash
cd frontend
npm install
npm run dev
```

### Important frontend rules

1. **Leave `VITE_API_URL` unset** during `npm run dev`. Vite proxies `/api` → middleware `:4000`. Setting `VITE_API_URL=http://localhost:4000` often causes CORS / connection issues if middleware is down.
2. Only set `VITE_API_URL` for production builds or `vite preview` when the API is on another origin.
3. Optional local keys go in `frontend/.env.local` (never commit it):
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_RECAPTCHA_SITE_KEY`
   - feature flags (`VITE_FEATURE_*`)

---

## 7. Configuration files (what to create and what to set)

### Minimum for local H2 (portable)

| File | Action | Required? |
|------|--------|-----------|
| `middleware/.env` | Copy from `middleware/.env.example` (or run bootstrap) | **Yes** |
| Repo root `.env` | **Not required** for `test` profile. Blank secret lines are OK; defaults fill in. | No |
| `frontend/.env.local` | Optional; leave `VITE_API_URL` unset | No |
| `scraper/.env` | Optional | No |

### Full matrix (all environments)

| File | Used by | Purpose |
|------|---------|---------|
| `middleware/.env` | Node | `JAVA_BACKEND_URL`, `APP_INTERNAL_SECRET`, `JWT_PUBLIC_KEY`, CORS, cookies |
| Repo root `.env` | Java (loaded when running from `backend/`) | Secrets, DB, NVIDIA, Adzuna, Careerjet, Resend, Stripe, etc. Start from `.env.example` |
| `frontend/.env.local` | Vite | Only `VITE_*` keys (Google, reCAPTCHA, flags) |
| `frontend/.env.example` | Docs only | Template — do not rely on committing secrets |
| `scraper/.env` | Python scraper | LLM keys for scrape sidecar; optional |
| `backend/.../application.properties` | Java | Non-secret defaults. **Never put real passwords/API keys here.** |
| `backend/.../application-test.properties` | Java `test` | H2 URL, port 8100, local captcha/stripe knobs |

### Secrets that must match across services

| Secret | Java | Middleware |
|--------|------|------------|
| Internal HMAC | `APP_INTERNAL_SECRET` | `APP_INTERNAL_SECRET` (same string, ≥32 chars) |
| JWT | `JWT_PRIVATE_KEY_PEM` + `JWT_PUBLIC_KEY_PEM` | `JWT_PUBLIC_KEY` = public half (Base64 SPKI in local example) |

For the **`test`** profile, matching defaults are already baked in — use the middleware `.env.example` values as-is.

### Root `.env.example` note

The checked-in `.env.example` documents **all** production-oriented variables. For laptop H2:

- Prefer **not** setting `SPRING_PROFILES_ACTIVE=dev`
- Prefer leaving secret lines blank **or** omitting root `.env` entirely
- Use `SPRING_PROFILES_ACTIVE=test` only if you override env explicitly

Deep detail: [docs/LOCAL_ENV.md](docs/LOCAL_ENV.md).

---

## 8. Login credentials (local seed)

After the H2 database is created the first time:

| Field | Value |
|-------|--------|
| Email | `dev@careerops.ie` |
| Password | `password` |

If login fails after an old broken DB, stop Java, delete `%USERPROFILE%\.careerops\db\*.mv.db` (or `~/.careerops/db/`), restart the backend, then try again.

---

## 9. Optional API keys (jobs, AI, email, OAuth)

None of these are required to **boot** the stack. Add them to repo root `.env` (and restart Java) when you want the feature.

| Feature | Variables | Where to get |
|---------|-----------|--------------|
| AI match / skills | `NVIDIA_API_KEY` | https://build.nvidia.com |
| More IE jobs | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | https://developer.adzuna.com |
| UK jobs | `REED_API_KEY` | https://www.reed.co.uk/developers/jobseeker |
| Careerjet aggregator | `CAREERJET_API_KEY`, `CAREERJET_LOCALE`, `CAREERJET_REFERER` | https://www.careerjet.com/partners (whitelist outbound IP) |
| Web search in skills | `SERPAPI_API_KEY` | https://serpapi.com |
| Real OTP email | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_DEV_MODE=false` | https://resend.com |
| Google Sign-In | `GOOGLE_OAUTH_CLIENT_ID` + frontend `VITE_GOOGLE_CLIENT_ID` | Google Cloud Console (origin `http://localhost:5173`) |
| Onboarding reCAPTCHA | `captcha.secret` + `VITE_RECAPTCHA_SITE_KEY` | https://www.google.com/recaptcha/admin |
| Stripe | `STRIPE_*` | Stripe Dashboard (mocked in local `test`/`dev` unless configured) |

**Free job sources with no key:** Remotive, Jobicy, WeWorkRemotely, Arbeitnow, RemoteOK (and others already wired).

---

## 10. Postgres / production-like backend

Only when you intentionally want Postgres:

1. Copy `.env.example` → `.env` and fill **all** required secrets (`APP_MASTER_KEK`, `APP_INTERNAL_SECRET`, JWT PEMs, `SPRING_DATASOURCE_*` / Supabase).
2. Set `SPRING_PROFILES_ACTIVE=dev` (Java port **8080**).
3. Point middleware: `JAVA_BACKEND_URL=http://localhost:8080`.
4. Start: `cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev`

Staging/prod use Railway/Docker and platform-injected secrets — see `.env.example` environment matrix and `docker-compose*.yml`.

---

## 11. Troubleshooting

Run this first on a new machine:

```powershell
.\scripts\doctor-local.ps1
```

| Symptom | Fix |
|---------|-----|
| Postgres / connection refused on boot | You activated `dev`. Use `.\scripts\start-backend.ps1` or `mvn spring-boot:run` with default **`test`**. |
| FATAL missing `APP_INTERNAL_SECRET` / `APP_MASTER_KEK` / JWT | Blank root `.env` overrides. Use `test` profile (defaults apply) or fill real values / remove blank lines. |
| Port 8100 already in use / H2 lock | Stop other Java processes; delete `~/.careerops/db/*.lock.db` only after Java is stopped. |
| Middleware 401 / HMAC errors | `APP_INTERNAL_SECRET` must match Java; use the test string from `middleware/.env.example`. |
| Frontend loads but API fails | Middleware must use `JAVA_BACKEND_URL=http://localhost:8100` (not `:8080`). |
| `Schema "careerops" not found` | Reset H2 files under `~/.careerops/db/`, restart backend. |
| Scraper / Python errors | Optional — ignore, or re-run bootstrap with Python 3.11+. |
| Vite on 5174 | Port 5173 busy; ensure `ALLOWED_ORIGINS` includes `http://localhost:5174`. |

---

## 12. Project structure

```
frontend/       React + Vite + TypeScript (UI)
middleware/     Node.js Express (auth cookies, CORS, rate limit, proxy to Java)
backend/        Spring Boot (business logic, jobs, AI, Flyway, H2/Postgres)
scraper/        Optional Python Playwright sidecar (:5500)
scripts/        bootstrap / doctor / start-backend (Windows + Unix)
docs/           LOCAL_ENV, GDPR, evaluation contract, …
shared/         Shared fixtures (e.g. canonical mock job)
```

---

## 13. More documentation

| Doc | Purpose |
|-----|---------|
| [docs/LOCAL_ENV.md](docs/LOCAL_ENV.md) | Ports, secrets matrix, Google/Resend/CAPTCHA, job fetch |
| [docs/GDPR.md](docs/GDPR.md) | Consent, export, erasure, retention |
| [docs/EVALUATION_CONTRACT.md](docs/EVALUATION_CONTRACT.md) | Job evaluation JSON schema |
| [pagesflow/README.md](pagesflow/README.md) | Per-page frontend flows |
| [frontend/e2e/README.md](frontend/e2e/README.md) | Playwright E2E |

### Database migrations

Schema changes live in `backend/src/main/resources/db/migration` as Flyway scripts `V<N>__description.sql`. Do not reuse version numbers; deploy via Flyway (app startup or `mvn flyway:migrate`), not ad-hoc SQL.

---

## Quick checklist (print this)

- [ ] JDK 21+, Maven 3.9+, Node 20+ on PATH  
- [ ] `git clone` … `cd NewCareers`  
- [ ] `.\scripts\bootstrap-local.ps1` (or `.sh`)  
- [ ] Terminal 1: `.\scripts\start-backend.ps1` → health UP on `:8100`  
- [ ] Terminal 2: `cd middleware && npm i && npm run dev` → `:4000`  
- [ ] Terminal 3: `cd frontend && npm i && npm run dev` → `:5173`  
- [ ] Login `dev@careerops.ie` / `password`  
- [ ] Do **not** use Spring `dev` profile unless Postgres + secrets are ready  
