# Job scrape query formatting

Profile-driven delivery builds API/RSS search parameters in this chain:

## 1. Entry: profile → each source

`JobScrapeService.fetchRaw(UserProfile)` calls `JobSource.fetch(profile)` on every delivery source (Adzuna, Indeed RSS, IrishJobs, Jobs.ie, company pages, LinkedIn, etc.).

## 2. Default keyword + location + freshness

`JobSource.fetch(UserProfile)` (`backend/src/main/java/com/careerops/service/sources/JobSource.java`):

- **Keyword** — `JobListingMapper.profileKeyword(profile)` (first target role, else goal title, else `"software engineer"`)
- **Location** — `profile.getLocation()` or `"Ireland"`
- **Max age** — `profile.getFreshnessHours() / 24` (clamped 1–30 days), default 7

## 3. Per-board API formatting

Each source implements `fetch(String keyword, String location, int maxAgeDays)`:

| Source | File | Query shape |
|--------|------|-------------|
| Adzuna | `AdzunaSource.java` | `what={keyword}`, `where={location}`, `max_days_old={maxAgeDays}` |
| Indeed RSS | `IndeedRssSource.java` | RSS URL built from keyword + location |
| IrishJobs | `IrishJobsSource.java` | Site search URL + posted-after cutoff |
| Jobs.ie | `JobsIeSource.java` | Same pattern |
| LinkedIn public | `LinkedInPublicSource.java` | `keywords` + `location` + `f_TPR` time window |

Example (Adzuna URI builder):

```java
UriComponentsBuilder.fromHttpUrl("https://api.adzuna.com/v1/api/jobs/{country}/search/1")
    .queryParam("what", keyword)
    .queryParam("where", location.isBlank() ? "ireland" : location)
    .queryParam("max_days_old", maxAgeDays);
```

## 4. Matching after fetch

`JobDeliveryService` pre-ranks with `JobMatchingService` (role/stack relevance), then persists only jobs at or above `user_profiles.min_match_percent` via `JobProfileMatchPolicy`.

`GET /jobs` returns the same filtered pipeline (used by dashboard marquee and `/jobs` tracker).
