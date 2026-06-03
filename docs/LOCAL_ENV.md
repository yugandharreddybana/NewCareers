# Local environment setup

## Quick start (recommended)

Uses a **file-backed H2** database on Java port **8100** (default path `%USERPROFILE%\.careerops\db\` on Windows, `~/.careerops/db/` on macOS/Linux) so accounts and jobs **survive backend restarts**. One canonical mock job is seeded on first DB creation only.

```bash
# Terminal 1 — Java (default `test` profile)
cd backend
mvn spring-boot:run

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
| Seeded dev login | `dev@careerops.ie` / `password` (inserted only if missing; safe across restarts) |

If you previously ran the backend when it used **in-memory** H2, that data is gone — register again once, or use the seeded dev account above.

## Port & URL matrix

| Service    | URL | Notes |
|-----------|-----|--------|
| Frontend  | http://localhost:5173 | Do **not** set `VITE_API_URL=http://localhost:4000` in dev |
| Middleware| http://localhost:4000 | `JAVA_BACKEND_URL` must match Java |
| Java `test` profile | http://localhost:8100/api/v1 | Default in `application.properties` |
| Java `dev` profile  | http://localhost:8080/api/v1 | Requires Postgres + `application.properties` |

## Files to configure

| File | Purpose |
|------|---------|
| `middleware/.env` | `JAVA_BACKEND_URL`, `INTERNAL_TRUST_SECRET`, `JWT_PUBLIC_KEY`, Stripe placeholders |
| `frontend/.env` or `.env.development` | `VITE_DEV_BYPASS_GUARDS=false` (keep off); leave API URL unset |
| `middleware/.env` | `DEV_AUTO_AUTH=true` only if you need API calls without logging in |
| `frontend/.env.local` | `VITE_GOOGLE_CLIENT_ID` — same Web client ID as Java `GOOGLE_OAUTH_CLIENT_ID` |
| `backend/.../application.properties` | Only for **dev** profile with Postgres (copy from `application.example.properties`) |
| Repo root `.env` | Used when running Java with `dev` profile + Postgres; set `GOOGLE_OAUTH_CLIENT_ID` |

### Google Sign-In

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Create OAuth client ID** → **Web application**.
2. **Authorized JavaScript origins:** `http://localhost:5173` (and your production URL).
3. Copy the Client ID into:
   - `VITE_GOOGLE_CLIENT_ID` in `frontend/.env.local`
   - `GOOGLE_OAUTH_CLIENT_ID` in the environment when starting Java (or repo `.env`)
4. Restart **backend** and **frontend** after setting both values.

## Secrets that must match

`INTERNAL_TRUST_SECRET` in `middleware/.env` **must equal** `internal.trust.secret` in Java:

- `application-test.properties` → `test-internal-trust-secret-minimum-32-characters-long`
- `application-dev.properties` → same value (aligned)

`JWT_PUBLIC_KEY` in middleware must match `jwt.public-key` in Java.

## AI job matching (NVIDIA NIM)

Onboarding and job scoring call NVIDIA NIM. Without a key you still get scraped jobs, but match scores use a heuristic fallback (`AI engine not configured (NVIDIA NIM)` in Java logs).

1. Create a free API key at [build.nvidia.com](https://build.nvidia.com).
2. Set `NVIDIA_API_KEY` in the environment **before** starting Java (same shell as `mvn spring-boot:run`), or add to repo root `.env` if you load it into the process.
3. Restart the backend after setting the key.

Optional: `NVIDIA_MAX_CONCURRENT=2` (default) limits parallel scoring during onboarding.

## Adzuna (optional, more IE listings)

```bash
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
```

Register at [developer.adzuna.com](https://developer.adzuna.com/). Without these, Adzuna is skipped; IrishJobs, Jobs.ie, LinkedIn public, Remotive, and other sources still run.

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
