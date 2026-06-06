# Career Ops — limits and quotas

This document lists **user-facing limits**, **API rate limits**, and **per-source job fetch caps** as implemented in the codebase. Values shown are **defaults** unless your deployment overrides them in `application.properties` or environment variables.

**Daily reset timezone:** `Europe/Dublin` (Ireland) — midnight local time for job delivery and AI token budgets.

---

## Daily limits (per user)

| Limit | Default | Config key | What counts | Resets |
|--------|---------|------------|-------------|--------|
| **New jobs delivered** | **25 / day** | `jobs.max.per.user.per.day` | Each new job saved to your pipeline from fetch, onboarding delivery, or similar | Midnight **Europe/Dublin** |
| **AI token budget** | **500,000 tokens / day** | `ai.daily.token.budget` or `AI_DAILY_TOKEN_BUDGET` | NVIDIA model usage for skills (evaluate, tailor CV, research, cover letter, etc.) | Midnight **Europe/Dublin** |

### When the AI token budget is exhausted

- Skills that require the model may return an error or use **local/heuristic fallbacks** (e.g. tailor CV, evaluate).
- Deterministic features (skill lists on job load, keyword matching) still run without calling the model.

### Applications

There is **no daily cap** on kanban applications or Apply Assist submissions in the current codebase.

---

## Per-minute rate limits

These use **rolling windows** (not midnight reset).

| Layer | Limit | Window | Applies to |
|--------|-------|--------|------------|
| **Backend API (global)** | ~**60** requests/min per user (burst ~70) | 1 minute | Most authenticated `/api/v1/*` routes |
| **Middleware — job fetch** | **6** requests/min | 1 minute | `POST /jobs/fetch`, fetch-live, etc. |
| **Middleware — skills** | **30** requests/min | 1 minute | Skill routes via Node proxy |
| **Skills — start** | **5** / min | 1 minute | `POST /skills/start` |
| **Skills — conversation reply** | **5** / min | 1 minute | Paused skill Q&A |
| **Skills — apply answer** | **10** / min | 1 minute | Apply Assistant |
| **Skills — outreach draft** | **10** / min | 1 minute | Outreach drafts |
| **Skills — run all** | **2** / min | 1 minute | Run-all / run-all-async |
| **Skills — batch status** | **30** / min | 1 minute | Polling batch status |
| **CV download** | **10** / min | 1 minute | Signed CV download URLs |

---

## Auth and account limits

| Item | Limit | Reset |
|------|-------|--------|
| Password reset requests | **5 per user per 24 hours** | Rolling 24h |
| Login attempts (middleware) | **5 per 15 minutes** | 15 minutes |
| Other auth routes | **20 per 15 minutes** | 15 minutes |
| Skill conversations | Expire after **30 minutes** idle | `skill.conversation.expire.minutes` |
| Skill run cache (DB) | **24 hours** per job+skill ( **48 hours** for tailor-resume ) | `SkillRunCachePolicy`; stored in `skill_runs.expires_at` |
| Skill runs (global retention) | **90 days** then purged | `CronJobService.runGdprRetentionCleanup` |
| Skill runs (on AI consent withdraw) | Rows older than **30 days** purged | `DELETE /user/consent/ai` |
| Job eval in-memory cache | **Disabled** (`AiEvalCacheService` no-op) | Use `user_jobs.score_breakdown` / `skill_runs` instead |
| JWT access token | **15 minutes** | Refresh via auth flow |

---

## Job fetch API (user-initiated)

| Endpoint | Per-request cap | Notes |
|----------|-----------------|--------|
| `POST /jobs/fetch` | **1–25** jobs requested | Capped by **remaining daily quota** |
| `POST /jobs/fetch-irishjobs` | **1–10** | IrishJobs.ie only |
| Middleware `POST /jobs/fetch` | Query `count` clamped to **≤10** | Stricter than Java max in some paths |

---

## Background scrape — jobs per source (per fetch cycle)

When the system scrapes job boards for a user profile, each source returns up to the caps below. All sources run in parallel (timeout ~25s each). Results are deduplicated and filtered by freshness (`jobs.freshness.default.hours`, default **96 hours**).

| Source | Display name | Max jobs per fetch (typical) | Roles / queries | API key required |
|--------|----------------|---------------------------|-----------------|------------------|
| IrishJobs | IrishJobs | **40** total (up to **3** role URLs) | Profile target roles | No |
| Jobs.ie | Jobs.ie | **40** total (up to **3** role URLs) | Profile target roles | No |
| JobsIreland.ie | JobsIreland | Browse fallback limit | Profile-based | No |
| LinkedIn (Public) | LinkedIn | **20** total (up to **2** roles) | Guest search | No |
| Remotive | Remotive | **30** (API `limit=30`) | First target role | No |
| Jobicy | Jobicy | **30** (`count=30`) | Engineering remote | No |
| The Muse | The Muse | **1 page** (API default page size) | Engineering category | No |
| Reed | Reed | **30** (`resultsToTake=30`) | First role + Ireland | Yes (`reed.api.key`) |
| Adzuna | Adzuna | **30** per page (`results_per_page=30`) | Profile roles; **250/day** operator budget | Yes (`adzuna.app.id` / key) |
| We Work Remotely | WeWorkRemotely | RSS feed size | Category RSS | No |
| EuroJobs | EuroJobs | RSS / scrape limits | Feed-based | No |
| RSS (generic) | RSS | Feed-dependent | Configured feeds | No |
| Indeed (RSS) | Indeed | Feed-dependent | Ireland RSS search | No |
| SerpAPI (Google Jobs) | Google Jobs | Search-only (no background `fetch`) | On-demand search | Yes (`serpapi.api.key`) |
| Twin AI | LinkedIn (Twin AI) | Twin integration limits | When configured | Twin credentials |
| Company sites | Company site | Best match per company (~100 employers) | Tiered: ATS API → Playwright → Jsoup; **6h DB cache** | No |

**Company career fetch architecture:**

| Tier | Method | When used |
|------|--------|-----------|
| 1 | Greenhouse / Lever / Ashby JSON APIs | URL or registry marks ATS strategy |
| 2 | Playwright sidecar (`POST /scrape/jobs/playwright`) | JS SPAs (EY, Workday, Google, etc.); **auto-started** with backend on local dev |
| 3 | Jsoup HTML | Last resort for static pages |

- Background scan every **6 hours** (`company.careers.scan-cron`) upserts into `jobs` with source `jsoup-companies` (UI label: **Company site**).
- User **Fetch Jobs** reads cache first; optional live scan on fetch when cache is cold.
- **No AI** is used for company job discovery — only `JobMatchingService` heuristics.

**Operator / platform caps (not per user):**

| Item | Default | Config |
|------|---------|--------|
| SerpAPI web search (skills) | **100 / month** | `serpapi.monthly.limit` |
| Adzuna daily scrape budget | **250 / day** | `adzuna.daily.limit` |
| NVIDIA concurrent calls | **2** | `nvidia.max.concurrent` |
| Onboarding discovery pool | **200** jobs | `jobs.onboarding.discovery-pool-cap` |
| Cron auto-delivery | **3** jobs per run | `jobs.cron.daily.count` |
| Gemini pre-rank pool (legacy) | **25** | `jobs.gemini.prerank.pool` |

---

## Delivery pipeline (after scrape)

| Step | Limit | Notes |
|------|-------|--------|
| User daily save | **25** new jobs | `DailyLimitService` |
| Pre-rank pool | **25** candidates | `jobs.gemini.prerank.pool` |
| Match threshold | Profile `minMatchPercent` | Optional enforce: `jobs.enforce-min-match-percent` (default **false**) |

---

## Billing

Stripe billing and `GET /api/billing/usage` are **not implemented** (returns **501**). Usage in the nav comes from **`GET /api/v1/usage/limits`**.

---

## UI: usage in the navbar

When logged in, the top nav shows two pills (from `GET /api/v1/usage/limits`):

- **Jobs today** — `remaining / limit` (e.g. `18 / 25`); resets at midnight Ireland time.
- **AI tokens** — `remaining / limit` (e.g. `340k / 500k`); same reset.

Colors: green → amber → red as you approach zero. Hover a pill for the exact reset time.

If the backend or middleware is not running the `/usage` route, you will see “Usage unavailable” with a retry button.

## Fetch Jobs behaviour

When the user clicks **Fetch Jobs**:

1. **One job per job board/API source** — each enabled `JobSource` (IrishJobs, Jobs.ie, LinkedIn, Remotive, etc.) contributes its single best profile-matched listing.
2. **All company career pages** — every company in the career registry (~100 Ireland tech employers) contributes its best profile-matched role. Jobs are labeled **Company site** in the UI (`jsoup-companies` source).
3. Up to your **daily delivery limit**, the top matches are evaluated and saved to the pipeline.

Company list: see `JsoupCompanySource.CAREER_PAGES` and `company-careers.yml` strategy overrides (EY, Intercom, Stripe, Google, State Street pilots).

---

## Configuration reference

```properties
# application.properties (defaults)
jobs.max.per.user.per.day=25
ai.daily.token.budget=500000
jobs.freshness.default.hours=96
jobs.onboarding.discovery-pool-cap=200
nvidia.max.concurrent=2
serpapi.monthly.limit=100
adzuna.daily.limit=250
company.careers.cache-hours=6
company.careers.scan-cron=0 0 */6 * * *
scraper.base-url=${SCRAPER_BASE_URL:http://127.0.0.1:5500}
scraper.auto-start=true
```

Environment overrides: `AI_DAILY_TOKEN_BUDGET`, `JOBS_ONBOARDING_POOL_CAP`, `NVIDIA_MAX_CONCURRENT`, etc.

---

*Last updated from codebase audit. If behavior differs in your environment, check deployed `application.properties` and middleware `rateLimiter.ts`.*
