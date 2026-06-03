# Performance Batch 1 — Backend Core

## Summary of all changes

All changes are on `main`. Commit `bc4fa5c` + audit-fix commit.

---

## File-by-file reference

### `application.properties`
| Area | Change |
|---|---|
| GZIP | Enabled for JSON/XML/HTML/JS/CSS ≥ 1 KB |
| HTTP/2 | Enabled |
| Tomcat threads | max=200, min-spare=20, accept-count=100, keep-alive=30s |
| HikariCP | min-idle=5, max-lifetime=30min, keepalive=60s, validation-timeout=3s |
| Hibernate batch | batch_size=50, order_inserts=true, order_updates=true |
| Jackson | non_null serialization, ISO dates |
| Async pool sizes | All externalised as properties |
| Logging | Spring/Hibernate/Hikari → WARN |
| Actuator | p50/p75/p95/p99 histograms enabled |

### `application-prod.properties`
- Swagger disabled in prod
- Only `/health` + `/prometheus` actuator endpoints exposed
- Larger HikariCP (max=30) and Tomcat (max=400) pools
- Root log level WARN

### `AppConfig.java`
- `@Primary` shared `OkHttpClient` bean with `ConnectionPool`
- Configurable via `scraper.http.*` properties
- Used by all scrapers via `JobApiHttpClient`

### `AsyncConfig.java` — 3 dedicated thread pools
| Pool | Core | Max | Queue | Rejection |
|---|---|---|---|---|
| `scraperExecutor` | 8 | 32 | 500 | CallerRuns |
| `aiExecutor` | 4 | 16 | 200 | CallerRuns |
| `emailExecutor` | 2 | 8 | 100 | DiscardOldest |

### `CacheConfig.java` — Caffeine caches
| Cache | TTL | Max |
|---|---|---|
| `jobs` | 5 min | 5 000 |
| `userProfile` | 10 min | 2 000 |
| `jobStats` | 5 min | 2 000 |
| `aiResult` | 60 min | 10 000 |
| `sourceMetadata` | 60 min | 500 |

### `RequestLoggingFilter.java`
- correlationId UUID on every request (MDC + `X-Correlation-Id` response header)
- `METHOD URI → STATUS (ms)` log per request (INFO/WARN/ERROR by status)
- Skips `/actuator` paths

### `GlobalExceptionHandler.java` (audit-fixed)
- Handles `ApiException` (primary exception) with full `ErrorResponse` record
- `Retry-After` header emitted when `retryAfterSeconds` is set
- `captchaRequired` flag propagated in response body
- Handles `MethodArgumentNotValidException` with per-field errors map
- Handles `ConstraintViolationException` with per-field errors map
- Handles `HttpMessageNotReadableException` (malformed JSON)
- Handles `HttpRequestMethodNotSupportedException` (405)
- Handles `HttpMediaTypeNotSupportedException` (415)
- Handles `IllegalArgumentException`, `IllegalStateException`, `NoSuchElementException`, `AccessDeniedException`
- Catch-all for unexpected exceptions (logs full stack trace server-side only)
- All responses use `ErrorResponse` record — no raw `Map.of()`

### `WebClientConfig.java` (audit-upgraded)
- Pool raised to 100 connections
- `evictInBackground(120s)`, `maxIdleTime(30s)`, `maxLifeTime(600s)` for pool hygiene
- `pendingAcquireTimeout` raised to 45s
- `logRequest`/`logResponse` demoted to DEBUG (removes production noise)
- `propagateMdc` now forwards both `correlationId` AND `userId`

### `JobApiHttpClient.java`
- Uses injected shared `OkHttpClient` bean
- Consistent headers on all outbound calls

### `DeduplicationService.java`
- `ConcurrentHashMap` O(n) dedup
- Input capped at 5 000 entries

### `HealthCheckController.java`
- `GET /api/v1/health/status` → DB ping + source count + overall UP/DEGRADED

---

## Next batches
- **Batch 2** — Scraping resilience: circuit breakers (Resilience4j), per-domain rate limiters, source-first cron
- **Batch 3** — AI pipeline: result caching, async evaluation, WebSocket push
- **Batch 4** — DB: index audit, N+1 elimination, pagination enforcement
- **Batch 5** — Frontend: virtualised list, React.memo, lazy routes, bundle splitting
