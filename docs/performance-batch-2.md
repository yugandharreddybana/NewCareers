# Performance Batch 2 — Scraping Resilience

## What was changed

### New files

#### `ScraperCircuitBreaker.java`
Lightweight per-source state machine: CLOSED → OPEN → HALF_OPEN → CLOSED.
- Trips after `scraper.resilience.failure-threshold` consecutive failures (default 5).
- Stays OPEN for `scraper.resilience.open-duration-ms` (default 2 min).
- Recovers after `scraper.resilience.success-threshold` successes in HALF_OPEN (default 2).
- Fully thread-safe: AtomicInteger for counters, volatile for state.
- Zero external dependencies.

#### `SourceRateLimiter.java`
Per-domain semaphore-based rate limiter backed by ConcurrentHashMap.
- Prevents flooding any single job board with concurrent requests.
- `max-concurrent-domain` (default 3) permits per domain.
- Acquire timeout prevents indefinite blocking.

#### `SourceHealthRegistry.java`
Per-source metrics store (Spring `@Component`, singleton):
- `totalCalls`, `totalSuccesses`, `totalFailures`, `consecutiveFails`
- `lastSuccessAt`, `lastFailureAt`, `lastError`, `lastJobCount`
- `circuitState` (CLOSED/OPEN/HALF_OPEN)

#### `ResilientJobSource.java`
Decorator wrapping any `JobSource` with all resilience layers:
1. Circuit breaker check (returns empty immediately if OPEN)
2. Rate limiter acquire (skips if domain at capacity)
3. Timed call via executor (enforces `call-timeout-ms`)
4. Health registry update on every outcome

#### `ScraperResilienceConfig.java`
Spring `@Configuration` that auto-wraps every registered `JobSource` bean
with `ResilientJobSource`. No changes needed in individual source classes.

#### `SourceHealthController.java`
- `GET /api/v1/health/sources` — all sources
- `GET /api/v1/health/sources/{name}` — single source

### Modified files

#### `AdzunaSource.java`
- Replaced `new RestTemplate()` with injected `JobApiHttpClient` (pooled OkHttpClient).
- URL built with `UriComponentsBuilder` for safe encoding.
- `ObjectMapper` injected (Spring-managed singleton).

#### `ReedSource.java`
- Same refactor: `JobApiHttpClient` + `UriComponentsBuilder`.
- Basic auth header passed via `getWithHeader()`.

#### `JobApiHttpClient.java`
- Added `getWithHeader(url, headerName, headerValue)` method.
- `@Qualifier("sharedHttpClient")` for unambiguous injection.

#### `application.properties`
Added `scraper.resilience.*` configuration block.

---

## Resilience flow per source call

```
JobScrapeService.scrapeAll()
  └─ ResilientJobSource.fetch()
       ├─ [1] CircuitBreaker.allowCall()  → OPEN? return []
       ├─ [2] RateLimiter.tryAcquire()   → saturated? return []
       ├─ [3] executor.submit() with timeout
       │     └─ delegate.fetch() (actual scraper)
       └─ [4] HealthRegistry.record(success|failure)
             CircuitBreaker.record(success|failure)
```

---

## Configuration reference

| Property | Default | Description |
|---|---|---|
| `scraper.resilience.failure-threshold` | 5 | Consecutive failures before circuit trips |
| `scraper.resilience.open-duration-ms` | 120000 | ms circuit stays OPEN before probing |
| `scraper.resilience.success-threshold` | 2 | Successes in HALF_OPEN to recover |
| `scraper.resilience.call-timeout-ms` | 30000 | Per-source call timeout ms |
| `scraper.resilience.max-concurrent-domain` | 3 | Max concurrent calls per domain |
| `scraper.resilience.rate-limit-timeout-ms` | 5000 | Wait for rate-limit permit ms |

---

## Next batches
- **Batch 3** — AI pipeline: result caching, async evaluation, WebSocket push
- **Batch 4** — DB: index audit, N+1 elimination, pagination enforcement
- **Batch 5** — Frontend: virtualised list, React.memo, lazy routes, bundle splitting
