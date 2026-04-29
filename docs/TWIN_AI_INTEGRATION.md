# Twin AI Integration — LinkedIn Job Fetching

## What is Twin AI?
[Twin AI](https://twin.so) is a browser-automation-as-a-service platform.
You describe a task in plain English, Twin runs a real browser session, and returns
structured output. This lets CareerOps fetch LinkedIn job listings without
needing LinkedIn API access or maintaining browser sessions yourself.

## How it works in CareerOps

```
User triggers "Get More Jobs"
        │
        ▼
JobScrapeService.fetchRaw(profile)
        │
        ├── IrishJobsSource      (Jsoup scrape → IrishJobs.ie)
        ├── JobsIeSource         (Jsoup scrape → Jobs.ie)
        ├── JsoupCompanySource   (100+ Irish company career pages)
        ├── RemotiveSource       (Remotive API)
        ├── JobicySource         (Jobicy API)
        ├── RssSource            (RSS feeds)
        ├── ReedSource           (Reed API)
        ├── AdzunaSource         (Adzuna API)
        └── TwinAiSource  ◄────  Twin AI browser → LinkedIn Jobs
                │
                ▼
        Returns List<Job> with live LinkedIn postings
                │
                ▼
        JobMatchingService.topN()  — fast pre-score (free)
                │
                ▼
        Gemini evaluates top 25 — deep AI scoring
```

## Setup

1. Sign up at [https://twin.so](https://twin.so) and get an API key.
2. In `backend/src/main/resources/application.properties`:
   ```properties
   twin.api.key=YOUR_TWIN_API_KEY
   twin.enabled=true
   ```
3. Restart the backend (`./mvnw spring-boot:run`).
4. LinkedIn jobs will appear automatically in the next fetch.

## How TwinAiSource works

- Sends a plain-English task to `POST https://api.twin.so/v1/agent/run`
- Task instructs Twin to search LinkedIn Jobs for your target role + location + freshness filter
- Twin returns a JSON array: `[{ title, company, location, url, description, posted_at }, ...]`
- TwinAiSource maps each object to a `Job` entity and adds it to the scrape pool
- All Twin-sourced jobs are labelled `source_name = "LinkedIn (Twin AI)"`
- Max 25 jobs per role, 2 roles per fetch cycle

## Auto-generated task prompt (per role)

```
Go to https://www.linkedin.com/jobs/search/ and search for "Full Stack Developer"
jobs in "Ireland". Filter by: date posted = past 4 days, job type = full-time.
For each job listing on the first 2 pages extract:
  title, company, location, url, description (500 chars), posted_at
Return ONLY a valid JSON array. Limit 25 results.
```

## Cost & limits

- Each Twin AI call = 1 browser-agent session (billed per your Twin plan)
- CareerOps runs 1–2 Twin calls per user fetch (one per target role, max 2)
- `twin.enabled=false` by default — **zero cost until you explicitly enable it**
- Check [https://twin.so/pricing](https://twin.so/pricing) for current rates

## Extending to Glassdoor / Indeed

To add Glassdoor or Indeed via the same pattern:

1. Create a new `@Component` (e.g. `TwinGlassdoorSource.java`) implementing `JobSource`
2. Copy the structure of `TwinAiSource`, change the task prompt to target Glassdoor/Indeed
3. Add separate properties: `twin.glassdoor.enabled`, `twin.indeed.enabled`
4. Wire into `JobScrapeService` constructor

## Troubleshooting

| Symptom | Fix |
|---|---|
| No LinkedIn jobs appear | Check `twin.enabled=true` and `twin.api.key` is set |
| Twin returns empty output | LinkedIn may have changed its layout — check Twin agent logs |
| JSON parse error | Twin returned markdown instead of pure JSON — update task prompt to be stricter |
| 401 Unauthorized | Invalid or expired API key — regenerate at twin.so |
