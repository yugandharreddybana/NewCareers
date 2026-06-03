# Performance Batch 1 — Backend Core

## What was changed

### 1. `application.properties`
- **GZIP compression** enabled for JSON, XML, HTML, JS, CSS responses >= 1 KB.
- **HTTP/2** enabled.
- **Tomcat thread pool** tuned: `max=200`, `min-spare=20`, `accept-count=100`, `connection-timeout=5s`, `keep-alive=30s`.
- **HikariCP** fully tuned: `max-pool=20`, `min-idle=5`, `max-lifetime=30m`, `keepalive=60s`, `validation-timeout=3s`.
- **Hibernate batch inserts** enabled: `batch_size=50`, `order_inserts=true`, `order_updates=true`.
- **Spring Cache** configured: Caffeine in-memory cache with 5 named caches.
- **Async pool sizes** externalised as properties so they can be overridden per-environment.
- **Jackson**: `write-dates-as-timestamps=false`, `default-property-inclusion=non_null` (smaller payloads).
- **Logging** levels tightened for Spring, Hibernate, and HikariCP to `WARN`.
- **Actuator** percentile histograms enabled for HTTP latency tracking (p50/p75/p95/p99).

### 2. `application-prod.properties`
- Stricter log levels in prod.
- Swagger/OpenAPI disabled in prod.
- Larger HikariCP and Tomcat pools for prod load.
- Only `/health` and `/prometheus` actuator endpoints exposed.

### 3. `AppConfig.java` — shared OkHttpClient bean
- Single `OkHttpClient` with `ConnectionPool` shared across all scrapers.
- Configurable `maxConnections`, `maxConnectionsPerHost`, timeouts, and keep-alive.
- Eliminates per-call TCP handshake overhead during parallel scraping.

### 4. `AsyncConfig.java` — three dedicated thread pools
| Pool | Purpose | Core | Max | Queue |
|---|---|---|---|---|
| `scraperExecutor` | Parallel job scraping | 8 | 32 | 500 |
| `aiExecutor` | AI scoring / evaluation | 4 | 16 | 200 |
| `emailExecutor` | Email dispatch | 2 | 8 | 100 |
- Separated so a slow AI call never starves scraping threads.
- Caller-runs rejection policy for scraper/AI (backpressure); discard-oldest for email.

### 5. `CacheConfig.java` — Caffeine caches
| Cache name | TTL | Max entries |
|---|---|---|
| `jobs` | 5 min | 5 000 |
| `userProfile` | 10 min | 2 000 |
| `jobStats` | 5 min | 2 000 |
| `aiResult` | 60 min | 10 000 |
| `sourceMetadata` | 60 min | 500 |
- Stats recording enabled so cache hit rates are visible via Actuator metrics.

### 6. `RequestLoggingFilter.java`
- Assigns a `correlationId` UUID to every request (MDC + `X-Correlation-Id` response header).
- Logs `METHOD URI → STATUS (elapsed ms)` at INFO/WARN/ERROR depending on status.
- Skips `/actuator` paths to keep logs clean.

### 7. `GlobalExceptionHandler.java`
- Centralised `@RestControllerAdvice` with structured JSON error bodies.
- No stack traces exposed to clients.
- Logs at WARN for 4xx, ERROR for 5xx.

### 8. `JobApiHttpClient.java`
- Refactored to use injected shared `OkHttpClient`.
- Consistent User-Agent, Accept, and gzip headers on every outbound call.

### 9. `DeduplicationService.java`
- Input capped at 5 000 entries to prevent OOM on runaway scrapes.
- ConcurrentHashMap for O(n) dedup, safe for multi-thread contexts.

### 10. `HealthCheckController.java`
- `GET /api/v1/health/status` returns DB ping, enabled source count, timestamp, and overall UP/DEGRADED status.

## Next batches
- **Batch 2** — Scraping resilience: circuit breakers, per-domain rate limiting, source-first cron pattern.
- **Batch 3** — AI pipeline: caching AI results, batching scoring, async evaluation with WebSocket push.
- **Batch 4** — Database: index audit, N+1 fixes, query pagination enforcement.
- **Batch 5** — Frontend: virtualised job list, React.memo, lazy routes, bundle splitting.
