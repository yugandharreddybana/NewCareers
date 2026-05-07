# Career-Ops — Comprehensive Engineering Audit

**Auditor:** Claude Opus 4.7 (Staff-Level Principal Engineer / Lead Security Auditor / System Architect)
**Date Started:** 2026-05-03
**Scope:** `backend/`, `frontend/`, `middleware/`, `db/` (excludes `skills/`, `e2e/`, `node_modules/`, `backend/target/`, `docs/`, `.kilo/`)
**Method:** Static read-only inspection; no code executed; no builds run.

## Severity legend
- **Critical** — exploitable security flaw, data loss, or production outage waiting to happen.
- **High** — definite bug, broken feature, or strong attack vector; ship blocker.
- **Medium** — incorrect behaviour under realistic conditions or meaningful weakness.
- **Low** — minor correctness, style, or maintenance issue.
- **Enhancement** — not broken, but a clear improvement for power, scale, resilience, or DX.

## Issue numbering
`<pass>.<3-digit-seq>` — pass = audit pass (1..10); seq monotonic per pass.

## Table of contents
- [Pass 1 — Backend: Bootstrap, Config, Security, Exception, Rate-Limit](#pass-1)
- [Pass 2 — Backend: Controllers](#pass-2)
- [Pass 3 — Backend: Services](#pass-3)
- [Pass 4 — Backend: Models + Repositories](#pass-4)
- [Pass 5 — Backend: DTOs + Email + Util](#pass-5)
- [Pass 6 — Frontend: Pages + Routing + Context](#pass-6)
- [Pass 7 — Frontend: Components](#pass-7)
- [Pass 8 — Frontend: Hooks/Services/Api/Lib/Types](#pass-8)
- [Pass 9 — Middleware](#pass-9)
- [Pass 10 — DB schema + migrations](#pass-10)

---

<a id="pass-1"></a>
## Pass 1 — Backend Bootstrap, Config, Security, Exception, Rate-Limit

### 1.001 — Duplicate Flyway version V9 (boot-blocker)
- **[Severity]:** Critical
- **[Location]:** backend/src/main/resources/db/migration/V9__interview_command_center.sql AND V9__notifications.sql
- **[The Issue]:** Two migrations share version 9; Flyway fails fast on duplicate version, application will not start in any env where Flyway runs from clean slate.
- **[The Fix/Implementation]:** Rename one to `V9.1__notifications.sql` (or `V9_1`) and re-record checksums; verify on a fresh DB before merging.

### 1.002 — Internal trust secret comparison vulnerable to timing attack
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/security/InternalTrustFilter.java:70
- **[The Issue]:** `secret.equals(trustSecret)` short-circuits on first mismatched char, leaking secret length/prefix via response-time side-channel; same secret protects every internal call.
- **[The Fix/Implementation]:** Use `MessageDigest.isEqual(secret.getBytes(UTF_8), trustSecret.getBytes(UTF_8))` (constant-time), and reject early when either string is null or length mismatch.

### 1.003 — InternalTrustFilter accepts unvalidated userId from request header
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/security/InternalTrustFilter.java:68-75
- **[The Issue]:** `userId = req.getHeader(trustHeader)` is stored as Authentication principal with zero shape validation; a compromised middleware (or anyone who learns the secret) can impersonate any user including admin by sending an arbitrary string.
- **[The Fix/Implementation]:** Parse and validate against UUID regex (`^[0-9a-fA-F-]{36}$`) or numeric pattern; reject otherwise with 401; cap header length at 64 chars.

### 1.004 — InternalTrustFilter silently passes through on bad/missing secret
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/security/InternalTrustFilter.java:70-78
- **[The Issue]:** If secret mismatches or is missing, filter does not log, count, or short-circuit — request continues to chain, relying on later layer to 401, masking attack patterns and producing no metrics.
- **[The Fix/Implementation]:** Log warn on mismatch with sanitized client IP and path, increment a Micrometer counter (`security.trust.failed`), and return 401 immediately.

### 1.005 — JWT secret not validated at boot
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/security/JwtService.java:26-34
- **[The Issue]:** `Keys.hmacShaKeyFor` throws `WeakKeyException` only on first sign/verify call if secret < 32 bytes; bad config produces a runtime 500 instead of failing the application context.
- **[The Fix/Implementation]:** Add `@PostConstruct` that calls `key()` once and asserts `secret.getBytes(UTF_8).length >= 32`; throw `IllegalStateException` to fail-fast on startup.

### 1.006 — JWT lacks issuer/audience/jti claims and revocation hook
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/security/JwtService.java:38-47
- **[The Issue]:** Token only has `sub` and `email`; no `iss`, `aud`, `jti`; logout cannot invalidate (no blacklist/redis); leaked JWT remains valid for full 7-day expiry across all environments.
- **[The Fix/Implementation]:** Add `iss=careerops`, `aud=web|mobile`, `jti=UUID`; store `jti` in refresh-token table with revoked flag; reject tokens whose `jti` is revoked.

### 1.007 — JWT expiry of 7 days is excessive for an access token
- **[Severity]:** High
- **[Location]:** backend/src/main/resources/application.properties:28 (`jwt.expiry.ms=604800000`)
- **[The Issue]:** Stolen access token grants 7 days of full-trust access with no rotation; refresh-token migration V13 exists but JWT design is single-token long-lived.
- **[The Fix/Implementation]:** Set `jwt.expiry.ms=900000` (15 min) for access; rely on refresh-token endpoint for renewal; document split-token model.

### 1.008 — JwtService uses HS256 (symmetric); shared secret across instances and middleware
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/security/JwtService.java:32
- **[The Issue]:** Same secret signs and verifies; middleware also has it (per `.env.example:37`); compromise of any node compromises issuance; key rotation requires synchronized restart of every component.
- **[The Fix/Implementation]:** Move to RS256 with private key in backend only; middleware verifies using public key; rotate keys via JWKS endpoint.

### 1.009 — JwtService.isTokenValid swallows JwtException without logging
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/security/JwtService.java:79-86
- **[The Issue]:** Catch-Exception with no log makes signature failures, expired tokens, and malformed tokens indistinguishable; impossible to detect attack vs ordinary expiry from logs.
- **[The Fix/Implementation]:** Catch `ExpiredJwtException`, `SignatureException`, `MalformedJwtException` separately; log at warn with type label; keep boolean return.

### 1.010 — JwtService.extractEmail returns null silently on missing claim
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/security/JwtService.java:69-71
- **[The Issue]:** Caller cannot distinguish "no email claim present" from "empty string"; if any old token (pre-feature) lacks the claim, callers NPE downstream.
- **[The Fix/Implementation]:** Throw `ApiException.unauthorized("malformed token")` when claim is null; let GlobalExceptionHandler return 401.

### 1.011 — SecurityConfig: CSRF disabled globally without justification
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/config/SecurityConfig.java:35
- **[The Issue]:** CSRF disable is correct for stateless JWT but no comment explains why; future maintainer may flip session policy without re-evaluating.
- **[The Fix/Implementation]:** Add comment block explaining stateless JWT model and that authentication is by trust header; reference InternalTrustFilter.

### 1.012 — SecurityConfig: no security headers configured
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/config/SecurityConfig.java:34-46
- **[The Issue]:** Spring's default headers were not customized; no HSTS, no CSP, no Referrer-Policy, no Permissions-Policy; browser-facing API endpoints are exposed.
- **[The Fix/Implementation]:** Add `.headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives("default-src 'none'")).referrerPolicy(r -> r.policy(STRICT_ORIGIN_WHEN_CROSS_ORIGIN)).httpStrictTransportSecurity(s -> s.maxAgeInSeconds(31536000).includeSubDomains(true)).frameOptions(f -> f.deny()))`.

### 1.013 — SecurityConfig: no requiresChannel().requiresSecure() in production
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/config/SecurityConfig.java:34-46
- **[The Issue]:** App will accept plain HTTP if put behind a misconfigured reverse proxy; cookies and auth tokens would travel cleartext.
- **[The Fix/Implementation]:** Profile-gated `.requiresChannel(c -> c.anyRequest().requiresSecure())` enabled in `prod` profile; trust X-Forwarded-Proto.

### 1.014 — SecurityConfig: permitAll on `/auth/**` allows authenticated endpoints to skip auth
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/config/SecurityConfig.java:38
- **[The Issue]:** Any future controller mapped under `/auth/...` (e.g. `/auth/profile/me`) is silently public; `InternalTrustFilter`'s narrower whitelist diverges from Spring Security's, creating two sources of truth.
- **[The Fix/Implementation]:** Replace with explicit list mirroring InternalTrustFilter: `.requestMatchers("/auth/register","/auth/login","/auth/forgot-password","/auth/reset-password","/auth/refresh","/health").permitAll()`.

### 1.015 — CorsConfig: origins.split(",") without trim()
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/config/CorsConfig.java:23
- **[The Issue]:** Whitespace around comma-separated values produces literal " https://x.com" with leading space, silently failing CORS for that origin in production.
- **[The Fix/Implementation]:** `Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList()`.

### 1.016 — CorsConfig: setAllowedHeaders("*") combined with setAllowCredentials(true)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/config/CorsConfig.java:22,25
- **[The Issue]:** Spring's wildcard with credentials echoes any requested header, broader than spec; older browsers treat it as misconfiguration; no defense-in-depth on which headers cross.
- **[The Fix/Implementation]:** Whitelist explicitly: `List.of("Content-Type","Authorization","X-Requested-With","X-CSRF-Token")`.

### 1.017 — CorsConfig: no setExposedHeaders for X-RateLimit-* / Retry-After
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/config/CorsConfig.java:20-29
- **[The Issue]:** `RateLimitFilter` sets `X-RateLimit-Remaining` and `Retry-After`, but browser fetch() can't read them without exposeHeaders, breaking client-side throttle UX.
- **[The Fix/Implementation]:** `cfg.setExposedHeaders(List.of("X-RateLimit-Remaining","X-RateLimit-Reset","Retry-After"))`.

### 1.018 — CorsConfig: no setMaxAge → preflight on every request
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/config/CorsConfig.java:20-29
- **[The Issue]:** Default 1800s max-age is OK in some browsers; Spring's omission causes per-call OPTIONS preflight in some edge cases, doubling RTT for non-simple requests.
- **[The Fix/Implementation]:** `cfg.setMaxAge(Duration.ofHours(1))`.

### 1.019 — AsyncConfig: no rejection handler or graceful shutdown
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/config/AsyncConfig.java:18-26
- **[The Issue]:** Default `AbortPolicy` throws `RejectedExecutionException` when queue full → caller sees raw RuntimeException not ApiException; no `setWaitForTasksToCompleteOnShutdown(true)` so in-flight Gemini calls die mid-flight on container stop.
- **[The Fix/Implementation]:** `exec.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy()); exec.setWaitForTasksToCompleteOnShutdown(true); exec.setAwaitTerminationSeconds(60);`.

### 1.020 — AsyncConfig: no exception handler for uncaught async errors
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/config/AsyncConfig.java:14-27
- **[The Issue]:** AsyncConfigurer.getAsyncUncaughtExceptionHandler not overridden; exceptions in `void` async methods are swallowed; failures invisible.
- **[The Fix/Implementation]:** Override `getAsyncUncaughtExceptionHandler()` to return a `SimpleAsyncUncaughtExceptionHandler` that logs at error level with method name and args.

### 1.021 — AsyncConfig: pool sizes hardcoded
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/config/AsyncConfig.java:20-22
- **[The Issue]:** core=10, max=50, queue=500 cannot be tuned per environment; small instance might OOM, large instance throttled.
- **[The Fix/Implementation]:** Inject via `@Value("${async.core.pool.size:10}")` etc.; document tuning bounds.

### 1.022 — WebClientConfig: no connection timeout
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/config/WebClientConfig.java:14-20
- **[The Issue]:** Only response timeout set; if Anthropic/SerpAPI DNS or TCP handshake hangs, request waits indefinitely on connect, holding a thread; one slow upstream can drain the pool.
- **[The Fix/Implementation]:** `.option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000).doOnConnected(c -> c.addHandlerLast(new ReadTimeoutHandler(60)).addHandlerLast(new WriteTimeoutHandler(30)))`.

### 1.023 — WebClientConfig: connection pool unbounded by default
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/config/WebClientConfig.java:14-20
- **[The Issue]:** Default ConnectionProvider has no max-connections cap; under daily-cron burst, hundreds of TCP connections to Anthropic; exhausts ephemeral ports / triggers upstream rate-limits.
- **[The Fix/Implementation]:** `ConnectionProvider.builder("careerops").maxConnections(50).pendingAcquireTimeout(Duration.ofSeconds(30)).build()` and pass to `HttpClient.create(provider)`.

### 1.024 — WebClientConfig: 8MB in-memory size with no streaming
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/config/WebClientConfig.java:19
- **[The Issue]:** Whole response buffered to RAM; 50 concurrent Claude calls × 8MB = 400MB heap pressure.
- **[The Fix/Implementation]:** Stream via `bodyToFlux(String.class)` for large responses; keep 8MB only for small JSON bodies; consider 2MB default.

### 1.025 — WebClientConfig: no shared WebClient.Builder customizers (logging, headers)
- **[Severity]:** Enhancement
- **[Location]:** backend/src/main/java/com/careerops/config/WebClientConfig.java:14-20
- **[The Issue]:** Missing exchange filter for outbound logging, retry, request-id propagation; observability of outbound traffic effectively zero.
- **[The Fix/Implementation]:** Add `.filter(logRequest()).filter(logResponse()).filter(propagateMdc())` filter chain; consider `ExchangeFilterFunction.ofRequestProcessor` for retry on 429/5xx.

### 1.026 — RateLimitFilter: in-memory ConcurrentHashMap never evicts (memory leak)
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/ratelimit/RateLimitFilter.java:61
- **[The Issue]:** Every distinct userId allocates a Bucket forever; over months/years of users, heap accumulates indefinitely; comment explicitly notes "Buckets are never explicitly evicted" but defers fix.
- **[The Fix/Implementation]:** Replace map with Caffeine `Cache<String,Bucket>` size 100k expireAfterAccess(1 hour); recreate bucket on miss is harmless because state is per-window.

### 1.027 — RateLimitFilter: per-instance, no shared store across pods
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/ratelimit/RateLimitFilter.java:61-97
- **[The Issue]:** Behind a load balancer with N pods, effective limit is N × 60/min per user; abusive client gets N× the budget; defeats stated security goal.
- **[The Fix/Implementation]:** Switch to bucket4j-redis with Lettuce client; distribute buckets via Redis; degrade to local on Redis outage.

### 1.028 — RateLimitFilter: no IP-based limit for unauthenticated paths
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/ratelimit/RateLimitFilter.java:88-92
- **[The Issue]:** Login/register/forgot-password are exempt from this filter; only AuthService's own throttle (if any) protects against credential stuffing — needs verification.
- **[The Fix/Implementation]:** Add second bucket keyed on remote IP for `/auth/login`,`/auth/register`,`/auth/forgot-password` at 10/min/IP with sliding window; place AFTER InternalTrustFilter but BEFORE chain.

### 1.029 — RateLimitConfig docstring contradicts code (initial burst claim is false)
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/ratelimit/RateLimitConfig.java:13-31
- **[The Issue]:** Comment claims "Initial burst of 10 extra tokens" but code has `initialTokens(60)` and `capacity(60)` — burst budget equals refill rate, no extra allowance for page-load fan-out.
- **[The Fix/Implementation]:** Either set `capacity(70).initialTokens(70)` to match docstring or correct comment to "no extra burst; capacity equals window".

### 1.030 — RateLimitFilter: ObjectMapper instantiated per-filter instead of injected
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/ratelimit/RateLimitFilter.java:67-69
- **[The Issue]:** Spring already has a configured `ObjectMapper` bean with project-wide settings; duplicating misses any future Jackson modules (e.g. Pdl).
- **[The Fix/Implementation]:** Inject Spring's `ObjectMapper` via constructor; remove local `new ObjectMapper().registerModule(...)`.

### 1.031 — RateLimitFilter: missing X-RateLimit-Limit and X-RateLimit-Reset headers
- **[Severity]:** Enhancement
- **[Location]:** backend/src/main/java/com/careerops/ratelimit/RateLimitFilter.java:103
- **[The Issue]:** Frontend can read `Remaining` but cannot compute reset timestamp or absolute limit, hampering UX (no countdown).
- **[The Fix/Implementation]:** Add `X-RateLimit-Limit: 60`; compute `X-RateLimit-Reset` as epoch second of next refill from `bucket.getAvailableTokens()` and refill rate.

### 1.032 — GlobalExceptionHandler: missing handlers for common exception types
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/exception/GlobalExceptionHandler.java
- **[The Issue]:** No handler for `DataIntegrityViolationException` (DB constraints leak as 500), `HttpMessageNotReadableException` (malformed JSON → 500), `MethodArgumentTypeMismatchException` (bad path/query type → 500), `MissingServletRequestParameterException`, `AccessDeniedException`, `ConstraintViolationException` (validation on @PathVariable).
- **[The Fix/Implementation]:** Add `@ExceptionHandler` for each, mapping to 400/403/409 with concise messages; never let infra exceptions reach the catch-all.

### 1.033 — GlobalExceptionHandler: 500 error log lacks request context
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/exception/GlobalExceptionHandler.java:85
- **[The Issue]:** `log.error("Unhandled exception", ex)` does not include URI, method, userId, or correlation-id; triage requires correlating timestamps manually.
- **[The Fix/Implementation]:** Inject `HttpServletRequest` into handlers; log `method=POST uri=/x userId=Y correlationId=Z`; add MDC for cross-cutting log enrichment.

### 1.034 — ErrorResponse lacks error code, path, correlationId, fieldErrors
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/exception/ErrorResponse.java:19-27
- **[The Issue]:** Frontend has only a free-text message; cannot programmatically branch on `USER_NOT_FOUND` vs `DUPLICATE_EMAIL`; multi-field validation flattened into one string; no path or trace-id for support.
- **[The Fix/Implementation]:** Extend record: `String code, String path, String correlationId, Map<String,String> fieldErrors`; populate from MDC and exception subtype.

### 1.035 — GlobalExceptionHandler: validation errors merged with `;` separator
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/exception/GlobalExceptionHandler.java:48-57
- **[The Issue]:** Three field errors collapse into "email is required; password too short; name is blank" — frontend cannot map per-field; UX shows generic banner instead of inline form errors.
- **[The Fix/Implementation]:** Build `Map<String,String>` of `field → defaultMessage`; populate `ErrorResponse.fieldErrors`; UI consumes per-field.

### 1.036 — GlobalExceptionHandler: no profile-aware stack-trace exposure
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/exception/GlobalExceptionHandler.java:82-90
- **[The Issue]:** In dev, hiding the exception detail wastes time; in prod, exposing it leaks internals; same logic both ways.
- **[The Fix/Implementation]:** Inject `Environment env`; if active profile is `dev|local`, include `ex.getClass().getSimpleName()` and root cause message in body.

### 1.037 — ApiException missing factory for 500/429
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/exception/ApiException.java:24-49
- **[The Issue]:** Helpers exist for 400/401/403/404/409/422 but not `internalError()` (500) or `tooManyRequests()` (429); services manually `new ApiException(HttpStatus.X, ...)`.
- **[The Fix/Implementation]:** Add `static ApiException internalError(String m) { ... }` and `tooManyRequests(String)` for parity.

### 1.038 — ApiException constructor lacks Throwable cause
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/exception/ApiException.java:17-20
- **[The Issue]:** When wrapping IO/SQL exceptions in domain failure, the original stack is lost; debugging requires hunting through logs for the unwrapped cause.
- **[The Fix/Implementation]:** Add overload `ApiException(HttpStatus, String, Throwable cause)` calling `super(message, cause)`.

### 1.039 — application.properties shipped with placeholder secrets in canonical filename
- **[Severity]:** High
- **[Location]:** backend/src/main/resources/application.properties (whole file) and .gitignore:94
- **[The Issue]:** File is gitignored but resides at the canonical Spring location; once a dev edits it locally, `git add -f` or fresh clone confusion can leak real keys; example file uses different name (`application.example.properties`) so two sources of truth coexist.
- **[The Fix/Implementation]:** Delete committed `application.properties`, keep only `application.example.properties`; use Spring config tree or environment variables (`SPRING_DATASOURCE_PASSWORD`) for runtime secrets.

### 1.040 — application.example.properties duplicate key supabase.bucket.cv
- **[Severity]:** Medium
- **[Location]:** backend/src/main/resources/application.example.properties:37,39
- **[The Issue]:** `supabase.bucket.cv=user-cvs` then `supabase.bucket.cv=cvs` — last write wins silently; depending on which downstream service reads, `user-cvs` or `cvs` resolves; bucket name divergence between envs.
- **[The Fix/Implementation]:** Remove line 39; ensure only one canonical bucket id; document mapping in comment.

### 1.041 — application.properties: no spring.profiles, dev/staging/prod undifferentiated
- **[Severity]:** High
- **[Location]:** backend/src/main/resources/application.properties (whole file)
- **[The Issue]:** Single property file with no profile separation; dev settings (debug logging, lax CORS) ride into prod unless an external override is supplied; risky default.
- **[The Fix/Implementation]:** Split into `application.properties` (shared), `application-dev.properties`, `application-prod.properties`; activate via `SPRING_PROFILES_ACTIVE` env var.

### 1.042 — application.properties: no spring.servlet.multipart.max-file-size
- **[Severity]:** Medium
- **[Location]:** backend/src/main/resources/application.properties
- **[The Issue]:** CV upload likely > Spring's default 1MB, causing MaxUploadSizeExceededException for valid resumes; user sees generic 413 with no path-specific guidance.
- **[The Fix/Implementation]:** Add `spring.servlet.multipart.max-file-size=10MB` and `spring.servlet.multipart.max-request-size=12MB`.

### 1.043 — application.properties: no Hikari tuning
- **[Severity]:** Medium
- **[Location]:** backend/src/main/resources/application.properties:11
- **[The Issue]:** Default pool size 10 may be insufficient for 30+ controllers + cron jobs; no connection-test query, no leak-detection threshold; production stalls under load.
- **[The Fix/Implementation]:** `spring.datasource.hikari.maximum-pool-size=20`, `connection-timeout=10000`, `idle-timeout=300000`, `leak-detection-threshold=15000`, `connection-test-query=SELECT 1`.

### 1.044 — No Spring Boot Actuator dependency or config
- **[Severity]:** Medium
- **[Location]:** backend/pom.xml + application.properties
- **[The Issue]:** No `/actuator/health`, no `/actuator/metrics`, no Prometheus scrape endpoint; HealthController exists but lacks DB / Redis / external API liveness; no observability into JVM, GC, threads.
- **[The Fix/Implementation]:** Add `spring-boot-starter-actuator` + `micrometer-registry-prometheus`; expose `health,metrics,info,prometheus` only; require auth on metrics in prod.

### 1.045 — pom.xml: spring-boot-starter-oauth2-resource-server included but unused
- **[Severity]:** Low
- **[Location]:** backend/pom.xml:29
- **[The Issue]:** OAuth2 resource server adds ~3MB and security auto-config that may conflict with bespoke `InternalTrustFilter`; no controller uses `@PreAuthorize` JWT claims.
- **[The Fix/Implementation]:** Remove the dependency unless a real OAuth2 flow is planned; document explicitly when it's needed.

### 1.046 — pom.xml: openhtmltopdf 1.1.24 may not exist in central
- **[Severity]:** Medium
- **[Location]:** backend/pom.xml:19,52,57
- **[The Issue]:** Latest published openhtmltopdf is 1.0.10; 1.1.24 either is from a private repo, a typo, or was pulled — build is fragile and depends on cache hits.
- **[The Fix/Implementation]:** Pin to known-good `1.0.10` from Maven Central or document the alternate repository in `<repositories>` block.

### 1.047 — pom.xml: no OWASP dependency-check or SBOM plugin
- **[Severity]:** High
- **[Location]:** backend/pom.xml:87-107
- **[The Issue]:** No CVE scanning of Java deps; vulnerable jjwt/postgres/poi versions can ship undetected; CI skips backend entirely (see 1.052).
- **[The Fix/Implementation]:** Add `org.owasp:dependency-check-maven` plugin in build profile `security`; integrate `cyclonedx-maven-plugin` for SBOM; fail build on CVSS ≥ 7.

### 1.048 — pom.xml: no spotbugs/pmd/checkstyle
- **[Severity]:** Enhancement
- **[Location]:** backend/pom.xml:87-107
- **[The Issue]:** No static analysis enforces null-safety, encoding-correctness, or style; review burden falls on humans.
- **[The Fix/Implementation]:** Add `spotbugs-maven-plugin` with `findsecbugs` rules; gate at warn for now.

### 1.049 — pom.xml: spring-boot-starter-mail included but never autoconfigured
- **[Severity]:** Low
- **[Location]:** backend/pom.xml:31
- **[The Issue]:** Need to confirm whether email path uses Spring's JavaMailSender or Resend HTTP API; if Resend (per `resend.api.key`), the starter is dead weight pulling in jakarta.mail.
- **[The Fix/Implementation]:** Confirm in Pass 5 (email package); if unused, remove the starter and the SMTP keys in `.env.example`.

### 1.050 — CI: no backend (Maven) build, test, or coverage at all
- **[Severity]:** Critical
- **[Location]:** .github/workflows/ci.yml (whole file)
- **[The Issue]:** Java code never compiled in CI; PRs touching backend cannot be validated automatically; integration tests under `backend/src/test/` are never run; regressions reach main unchecked.
- **[The Fix/Implementation]:** Add `backend` job: `mvn -B verify -DskipITs=false`; cache `~/.m2`; upload jacoco coverage; require status check.

### 1.051 — CI: npm audit set to continue-on-error
- **[Severity]:** Medium
- **[Location]:** .github/workflows/ci.yml:84,89
- **[The Issue]:** Security audit emits a warning but never fails the workflow; vulnerable packages merge with green CI.
- **[The Fix/Implementation]:** Remove `continue-on-error: true`; pin allowable advisories via `--audit-level=high`; document waiver process for false positives.

### 1.052 — CI: no test step for frontend or middleware
- **[Severity]:** High
- **[Location]:** .github/workflows/ci.yml (whole file)
- **[The Issue]:** Vitest tests exist (`frontend/src/test/`, see Pass 8) but `npm test` is never invoked; a green build hides broken behaviour.
- **[The Fix/Implementation]:** Add `npm run test --if-present` to both frontend and middleware jobs after the type-check.

### 1.053 — CI: no CodeQL / SAST scan, no Dependabot config
- **[Severity]:** Medium
- **[Location]:** .github/workflows/ + repo root
- **[The Issue]:** No automated SAST (CodeQL would catch SQL injection patterns); no `.github/dependabot.yml` so dependencies drift unsupervised.
- **[The Fix/Implementation]:** Add CodeQL workflow (Java + JS); add `dependabot.yml` for npm and maven daily.

### 1.054 — .env.example: jwt.secret naming mismatch with application.properties
- **[Severity]:** High
- **[Location]:** .env.example:58 vs application.properties:27
- **[The Issue]:** Example uses `spring.security.jwt.secret` and `spring.security.jwt.expiration-ms`; actual code reads `jwt.secret` and `jwt.expiry.ms`; copy-paste from example breaks startup.
- **[The Fix/Implementation]:** Align names — change example to `jwt.secret` and `jwt.expiry.ms`; remove the unused `spring.security.*` lines.

### 1.055 — .env.example commits dummy Stripe webhook secret pattern
- **[Severity]:** Low
- **[Location]:** .env.example:48
- **[The Issue]:** `STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME` is fine, but no comment about Stripe CLI for local testing leaves devs guessing.
- **[The Fix/Implementation]:** Add a brief comment block explaining `stripe listen --forward-to localhost:4000/billing/webhook`.

### 1.056 — README mention `dev/staging/prod` separation absent in code
- **[Severity]:** Low
- **[Location]:** application.properties + .env.example
- **[The Issue]:** No `application-prod.properties`, no `application-dev.properties`; running `--spring.profiles.active=prod` is silently a no-op.
- **[The Fix/Implementation]:** Create empty profile files and migrate origin/logging/JWT-expiry per profile.

### 1.057 — InternalTrustFilter exact path match misses trailing slash variants
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/security/InternalTrustFilter.java:62
- **[The Issue]:** `PUBLIC_PATHS.contains(path)` returns false for `/auth/login/`; user with trailing-slash hits filter and gets routed correctly, but auth flow inconsistencies can result.
- **[The Fix/Implementation]:** Normalize `path` by stripping trailing slash; use `AntPathMatcher` or store both variants.

### 1.058 — RateLimitFilter exempt path list duplicates InternalTrustFilter list
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/ratelimit/RateLimitFilter.java:52-59 and InternalTrustFilter.java:46-53
- **[The Issue]:** Two hardcoded `Set.of(...)` definitions of the same public-path list; drift inevitable when one is updated.
- **[The Fix/Implementation]:** Extract to `PublicPaths` constants class with `Set<String> AUTH_PUBLIC = Set.of(...)`; both filters import.

### 1.059 — RateLimitFilter: no try-catch around mapper.writeValue → IOException to client
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/ratelimit/RateLimitFilter.java:117
- **[The Issue]:** If response is committed elsewhere (e.g. by another filter), writing 429 body throws IOException, leading to noisy stack trace and 500 race.
- **[The Fix/Implementation]:** Wrap in try-catch, log warn `"failed to write 429 body"`, allow filter chain to terminate.

### 1.060 — No request correlation id (trace id) propagated end-to-end
- **[Severity]:** Medium
- **[Location]:** Backend filter chain, GlobalExceptionHandler
- **[The Issue]:** Distributed traces (frontend → middleware → backend) cannot be tied together; production triage of a single user click takes minutes of log scanning.
- **[The Fix/Implementation]:** Add `CorrelationIdFilter` early in chain that reads/generates `X-Correlation-Id`, stores in MDC, echoes in response; both middleware and frontend propagate.

### 1.061 — No CSRF protection on cookie-based auth (if any later)
- **[Severity]:** Medium
- **[Location]:** SecurityConfig.java:35
- **[The Issue]:** If frontend ever migrates to cookie-stored JWT (recommended for XSS-resistant httpOnly), the disabled CSRF leaves it open; team likely to flip session policy without re-enabling CSRF.
- **[The Fix/Implementation]:** Document explicit invariant: "if cookie auth is reintroduced, CSRF MUST be re-enabled" in SecurityConfig javadoc; fail build via ArchUnit test if both `cookie` and `csrf().disable()` appear.

### 1.062 — No HSTS preload, no Permissions-Policy, no X-XSS-Protection unset
- **[Severity]:** Medium
- **[Location]:** SecurityConfig.java
- **[The Issue]:** Even after issue 1.012 is fixed, modern hardened headers still missing; defense-in-depth weak against XSS-driven sniffing.
- **[The Fix/Implementation]:** Use Spring Security's `headers().permissionsPolicy(p -> p.policy("camera=(), geolocation=(), microphone=()"))` and explicit `frameOptions(deny)`.

### 1.063 — JwtService.expiryMs is long primitive; no upper bound
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/security/JwtService.java:30
- **[The Issue]:** Misconfigured `jwt.expiry.ms=999999999999` produces tokens valid for 30+ years with no startup warning.
- **[The Fix/Implementation]:** `@PostConstruct` validate `expiryMs > 0 && expiryMs <= 86400_000` (24h cap); throw on violation.

### 1.064 — No /health detail; HealthController existence not yet seen but unauthenticated
- **[Severity]:** Low
- **[Location]:** SecurityConfig.java:38 and InternalTrustFilter.java:52
- **[The Issue]:** `/health` is permitAll — typical, but if it returns DB connectivity / dependency status in JSON, that's information leakage to a probing attacker.
- **[The Fix/Implementation]:** `/health` returns `{"status":"UP"}` only; deep checks behind `/actuator/health/liveness` requiring auth.

### 1.065 — pom.xml: jackson-datatype-jsr310 not pinned (uses Spring's managed version)
- **[Severity]:** Enhancement
- **[Location]:** backend/pom.xml:62-63
- **[The Issue]:** Inheriting versions is good, but mixing pinned (jjwt 0.12.6) and unpinned creates inconsistency review noise.
- **[The Fix/Implementation]:** Either pin all explicit deps or remove versions and let parent dictate; document the rule.

### 1.066 — pom.xml: spring-boot-starter-validation present but no global ValidatorFactory customisation
- **[Severity]:** Enhancement
- **[Location]:** backend/pom.xml:30
- **[The Issue]:** Default validator messages are English-only; SaaS users worldwide get untranslated errors.
- **[The Fix/Implementation]:** Configure `LocalValidatorFactoryBean` with `MessageSource` resolved from `messages_xx.properties`.

### 1.067 — Schema config: `spring.jpa.properties.hibernate.default_schema=career_operations` but Flyway uses default
- **[Severity]:** High
- **[Location]:** backend/src/main/resources/application.properties:14 vs db/migration/*
- **[The Issue]:** Hibernate writes/reads `career_operations.*` but Flyway has no `spring.flyway.schemas` set, so migrations apply to `public` (or current_schema); tables may end up in wrong schema, validate fails.
- **[The Fix/Implementation]:** Set `spring.flyway.schemas=career_operations` and `spring.flyway.default-schema=career_operations`; verify all V*.sql files don't hardcode `public.`.

### 1.068 — application.properties: anthropic.model=claude-opus-4-5 but our cutoff has claude-opus-4-7
- **[Severity]:** Low
- **[Location]:** backend/src/main/resources/application.properties:43
- **[The Issue]:** Hardcoded model lags latest Anthropic GA; not a bug, but a missed accuracy/latency improvement.
- **[The Fix/Implementation]:** Update to `claude-opus-4-7` (or `claude-sonnet-4-6` for cost) and reload via property.

### 1.069 — application.properties: serpapi.api.key empty default
- **[Severity]:** Medium
- **[Location]:** backend/src/main/resources/application.properties:54
- **[The Issue]:** Empty string is treated as "configured" by Spring; first call to SerpAPI fails with 401 not "missing config" — confusing dev-time error.
- **[The Fix/Implementation]:** No default; `@Value("${serpapi.api.key:#{null}}")` plus startup warn if null.

### 1.070 — application.properties: hardcoded `anthropic.max.tool.iterations=25` may explode in cost
- **[Severity]:** Medium
- **[Location]:** backend/src/main/resources/application.properties:46
- **[The Issue]:** Up to 25 tool-call rounds per skill run; under abusive prompt with bad stop conditions, single skill can cost $10+; no spend cap.
- **[The Fix/Implementation]:** Add per-user daily token budget tracked via `AiTokenUsage` table (already present); abort skill run when budget exhausted; emit billing alert.

---

<a id="pass-2"></a>
## Pass 2 — Backend Controllers

### 2.001 — Six divergent authentication patterns across controllers
- **[Severity]:** Critical
- **[Location]:** controller/ — AuthUtil.currentUserId() (Jobs/Profile/Kanban/Watchlist/etc), @AuthenticationPrincipal Jwt (Account/Cv), @AuthenticationPrincipal UUID (Onboarding/Progress/Workspace/Experiment), @RequestHeader("X-User-Id") (Analytics), Authorization Bearer manual parse (Planner/Skills), and SecurityContextHolder.getPrincipal() inside AuthUtil
- **[The Issue]:** Six incompatible ways of extracting the caller's userId; only AuthUtil-style works given current SecurityConfig (no JwtDecoder bean, no custom ArgumentResolver for UUID); endpoints using @AuthenticationPrincipal Jwt or UUID will receive null and NPE — Account, Cv, Onboarding, Progress, Workspace, Experiment all silently broken at runtime.
- **[The Fix/Implementation]:** Pick one (AuthUtil); convert all controllers; delete unused JWT decoder import paths; add an ArchUnit test to fail build on non-canonical auth patterns.

### 2.002 — IDOR on InterviewController.getKit / historyForJob / getKitForJob
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/controller/InterviewController.java:58,86
- **[The Issue]:** `coachService.getKitForJob(userJobId)` and `mockService.historyForJob(userJobId)` do not pass the caller's userId; any authenticated user can read another user's interview kits and mock-session history by guessing UUIDs.
- **[The Fix/Implementation]:** Pass `AuthUtil.currentUserId()` into both service calls and verify ownership of the userJob row before returning data; throw ApiException.notFound on mismatch.

### 2.003 — IDOR on PlannerController.getTasksForJob / getDeadlines
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/controller/PlannerController.java:52-56,78-82
- **[The Issue]:** `getTasksForJob(userJobId)` and `getDeadlines(userJobId)` accept only path variable, no userId join; any authenticated caller can list tasks/deadlines for any job in the system.
- **[The Fix/Implementation]:** Inject `extractUserId(request)`, then `plannerService.getTasksForJob(userJobId, userId)` with ownership check returning 404 on mismatch.

### 2.004 — ExperimentAdminController: documented admin guard is not implemented
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/controller/ExperimentAdminController.java:18-77
- **[The Issue]:** Class javadoc says "Secured by @PreAuthorize('hasRole(ADMIN)')" but no annotation is present; any authenticated user can list assignment counts, change experiment status, and create new experiments — operational integrity destroyed.
- **[The Fix/Implementation]:** Add `@PreAuthorize("hasAuthority('ROLE_ADMIN')")` on the class; ensure InternalTrustFilter or middleware stamps `ROLE_ADMIN` on real admins; require X-Internal-Secret on top.

### 2.005 — ExperimentAdminController accepts raw JPA entity in @RequestBody
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/ExperimentAdminController.java:76-80
- **[The Issue]:** `create(@RequestBody Experiment body)` deserializes directly into a JPA entity; mass-assignment lets the caller set `createdAt`, `updatedAt`, internal counters, soft-delete flags etc.
- **[The Fix/Implementation]:** Introduce `CreateExperimentRequest` record with only the fields a user may set; map to entity inside the service.

### 2.006 — AdminController.requireAdminSecret uses non-constant-time equals
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/AdminController.java:42
- **[The Issue]:** `trustSecret.equals(provided)` leaks secret prefix via timing; admin endpoints (high value) are now publicly probeable for the secret.
- **[The Fix/Implementation]:** Use `MessageDigest.isEqual(trustSecret.getBytes(UTF_8), provided.getBytes(UTF_8))`.

### 2.007 — AccountController.changePassword does not invalidate active sessions
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/AccountController.java:53-70
- **[The Issue]:** Password change updates `passwordHash` but does not call `authService.revokeAllTokensForUser`; if the user is changing because of suspected breach, the attacker's existing JWT/refresh-token continues working until expiry.
- **[The Fix/Implementation]:** After successful password change, call `authService.revokeAllTokensForUser(userId)`; force re-login on this device by issuing a new pair via the same response.

### 2.008 — AccountController.deleteAccount uses @AuthenticationPrincipal Jwt with no JwtDecoder
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/controller/AccountController.java:54-99
- **[The Issue]:** Spring Security has no `JwtDecoder` bean (oauth2-resource-server is on classpath but unconfigured); `jwt` will be null at runtime → NPE on `jwt.getSubject()`; PATCH /api/account/password and DELETE /api/account both 500 on every call.
- **[The Fix/Implementation]:** Replace with `@RequestAttribute("userId") String userId` and `UUID.fromString(userId)`; delete the unused oauth2-resource-server dependency.

### 2.009 — CvController auth is broken end-to-end (same Jwt principal issue)
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/controller/CvController.java:35-77
- **[The Issue]:** All five endpoints depend on `@AuthenticationPrincipal Jwt jwt` which is never populated; CV history, upload, download, activate, delete all 500 in production.
- **[The Fix/Implementation]:** Replace with `AuthUtil.currentUserId()` everywhere or `@RequestAttribute("userId")`.

### 2.010 — CvController.activate mutates in memory, never persists
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/controller/CvController.java:58-67
- **[The Issue]:** `all.forEach(cv -> cv.setIsActive(...))` updates the JPA entities in memory; no `cvService.save` or `cvRepository.saveAll` follows; the response shows updated flags but the DB is unchanged; activation feature appears to work but doesn't.
- **[The Fix/Implementation]:** Move to a `@Transactional` service method that toggles `isActive` via `@Modifying` query (`UPDATE user_cvs SET is_active = (id = :id) WHERE user_id = :uid`).

### 2.011 — Onboarding/Progress/Workspace/Experiment use @AuthenticationPrincipal UUID
- **[Severity]:** Critical
- **[Location]:** OnboardingController:26,41 — ProgressController:23,30,37,44,52 — WorkspaceController:25,32,40,49,57,66,74 — ExperimentController:27,34
- **[The Issue]:** Spring Security's default `@AuthenticationPrincipal` resolver returns the principal as-is; without a custom `HandlerMethodArgumentResolver` mapping the principal to UUID, the parameter is always null; every endpoint NPEs on first DB call.
- **[The Fix/Implementation]:** Replace with `AuthUtil.currentUserId()` directly inside the controller body — six controllers, ~20 endpoints.

### 2.012 — AnalyticsController uses raw @RequestHeader("X-User-Id") header
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/AnalyticsController.java:30,40,58
- **[The Issue]:** Header is set by InternalTrustFilter but reading it directly bypasses any authentication-binding; if InternalTrustFilter is removed/reordered, controllers still read whatever the client sends; double-check inconsistency with SecurityContext principal.
- **[The Fix/Implementation]:** Use `AuthUtil.currentUserId()` like the rest; remove header parameter from method signature.

### 2.013 — PlannerController & SkillsController extract userId by parsing Authorization header
- **[Severity]:** Medium
- **[Location]:** PlannerController.java:101-108, SkillsController.java:227-231
- **[The Issue]:** Re-decoding the JWT inside the controller duplicates filter logic, doubles parse cost, and risks divergence (different secrets, expiry handling); throws raw `SecurityException` not ApiException → leaks to GlobalExceptionHandler as 500 with stack instead of 401.
- **[The Fix/Implementation]:** Replace with `AuthUtil.currentUserId()`; delete `extractUserId(request)` private helpers.

### 2.014 — Inconsistent base-path scheme: half use /api/* prefix, half don't
- **[Severity]:** Medium
- **[Location]:** controller/* — /api/account, /api/cv, /api/notifications, /api/onboarding, /api/planner, /api/progress, /api/experiments, /api/workspaces, /api/skills vs /auth, /admin, /jobs, /kanban, /networking, /referrals, /watchlists, /interviews, /profile, /outreach, /agent-memory, /resume-versions, /applications/auto, /analytics
- **[The Issue]:** Frontend axios baseURL must special-case which calls go through middleware vs direct; routes drift across releases; reverse-proxy rules become brittle.
- **[The Fix/Implementation]:** Pick `/api/v1/*` for everything; introduce `server.servlet.context-path=/api/v1` and remove per-controller `/api`.

### 2.015 — JobsController.list reads N+1: jobs.findById per UserJob
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/JobsController.java:42-64,158-174
- **[The Issue]:** Stream over user_jobs calls `jobs.findById(uj.getJobId())` per row — N+1 queries; for 100 jobs that's 101 round-trips; same pattern duplicated in `search`.
- **[The Fix/Implementation]:** Add `JobRepository.findAllById(Collection<UUID>)` (Spring Data provides `findAllById`); pre-load into a `Map<UUID,Job>` then resolve in the stream.

### 2.016 — JobsController.search filters all results in memory after fetching every user_job
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/JobsController.java:147-191
- **[The Issue]:** Comment says "efficient for typical pipeline size of < 500 jobs" but heavy SaaS users will exceed; `subList(from, to)` after full filter still pulls every row from DB; no DB-side pagination/index usage.
- **[The Fix/Implementation]:** Implement Spring Data `Specification<UserJob>` building dynamic `WHERE` clauses; use `Pageable` to push paging to DB.

### 2.017 — JobsController.detail leaks Job entity fields directly
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/JobsController.java:68-82
- **[The Issue]:** Constructs `JobDetailResponse` with 22 positional args; fragile to schema changes; missing-field bugs occur silently.
- **[The Fix/Implementation]:** Use a MapStruct mapper or a `JobDetailResponse.from(Job, UserJob)` static factory; covered by unit tests.

### 2.018 — KanbanController.attachCv has no file-type / size guardrails
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/KanbanController.java:27-31
- **[The Issue]:** Only `MultipartFile file` is forwarded to service; no MIME-type allowlist (PDF/DOCX), no size check beyond Spring's default 1MB; user can attach a 100MB binary or a malicious script that the next service stage executes.
- **[The Fix/Implementation]:** Validate `file.getContentType()` against `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; reject otherwise; cap size at 5MB explicitly.

### 2.019 — ProfileController.uploadCv `throws Exception` exposes raw IO/parse stack to GlobalExceptionHandler
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/ProfileController.java:50-59
- **[The Issue]:** Throwing raw `Exception` makes failure modes opaque; user sees "An unexpected error occurred"; no actionable feedback for "PDF unreadable" vs "Supabase down".
- **[The Fix/Implementation]:** Catch IOException → ApiException.badRequest("Could not read uploaded file"); catch Supabase 5xx → ApiException internalError; let validation errors bubble.

### 2.020 — ProfileController.downloadUrl returns empty string instead of 404
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/ProfileController.java:62-65
- **[The Issue]:** `Map.of("url", url == null ? "" : url)` masks "no active CV" as a successful response with blank URL; frontend has to special-case empty string.
- **[The Fix/Implementation]:** Throw `ApiException.notFound("No active CV")` when null; return 404; frontend handles error state.

### 2.021 — InterviewController uses Map<String,String> request bodies with no validation
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/InterviewController.java:43-83,100-108
- **[The Issue]:** generateKit, startMock, replyMock, updateStage all accept `Map<String,String>` and call `body.get("...")`; missing keys → null → NPE; invalid UUID strings → IllegalArgumentException 400 but with a stack-trace-flavoured message.
- **[The Fix/Implementation]:** Define typed request records (`GenerateKitRequest`, `StartMockRequest`, `ReplyRequest`, `UpdateStageRequest`) with `@Valid` and `@NotBlank` annotations.

### 2.022 — NetworkingController.updateStage throws raw IllegalArgumentException on bad enum
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/NetworkingController.java:67
- **[The Issue]:** `ContactPipelineStage.valueOf(body.get("stage"))` throws if invalid or null; reaches IllegalArgumentException handler (400) but message is enum-name only, not user-friendly.
- **[The Fix/Implementation]:** Validate manually with `Arrays.stream(values).map(Enum::name).toList().contains(...)`; return 400 with allowed-values list.

### 2.023 — ReferralController.validate is documented public but path is not in PUBLIC_PATHS
- **[Severity]:** High
- **[Location]:** ReferralController.java:53 + InternalTrustFilter PUBLIC_PATHS
- **[The Issue]:** Comment says "Public endpoint — called on the Signup page when ?ref=TOKEN is present" but `/referrals/validate/{token}` requires auth; signup flow that links friend referrals will 401 because the user is not authenticated yet.
- **[The Fix/Implementation]:** Add `/referrals/validate/{token}` to `PUBLIC_PATHS`; verify it's also exempt from RateLimitFilter or use a per-IP limiter.

### 2.024 — ReferralController.create accepts free-text email with no format validation
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/ReferralController.java:30-37
- **[The Issue]:** Trim + isEmpty only; "abc", "<script>" pass; downstream email send fails or worse, allows header injection.
- **[The Fix/Implementation]:** Use `@Valid CreateReferralRequest(@Email String email)` record.

### 2.025 — NotificationController.markAllRead lacks @Transactional and uses N+1 saveAll
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/NotificationController.java:45-52
- **[The Issue]:** Loads all unread, mutates in memory, calls saveAll — without @Transactional Hibernate flushes per save; with 500 unread that's 500 UPDATE statements; race window between read and write.
- **[The Fix/Implementation]:** Replace with `@Modifying @Transactional UPDATE Notification SET read = true WHERE userId = :uid AND read = false` query.

### 2.026 — NotificationController.list has no pagination
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/NotificationController.java:29-35
- **[The Issue]:** Returns every notification ever; users with thousands experience multi-MB JSON, slow render, browser hang.
- **[The Fix/Implementation]:** Replace with `Page<Notification> list(Pageable pageable)` using `findByUserId(userId, pageable)`.

### 2.027 — NotificationController bypasses service layer (direct repo)
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/NotificationController.java:27,33
- **[The Issue]:** Other modules use a service tier with @Transactional and business-logic; notification logic lives in controller, breaking the codebase convention.
- **[The Fix/Implementation]:** Introduce `NotificationService`; move repository calls + transaction boundaries there.

### 2.028 — OnboardingController uses JdbcTemplate raw SQL inside controller
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/OnboardingController.java:28-31
- **[The Issue]:** `jdbc.queryForList("SELECT step FROM onboarding_events ...")` runs in default schema; Hibernate uses `career_operations`; query may return zero rows in production due to schema mismatch.
- **[The Fix/Implementation]:** Move query to a JpaRepository with proper entity; default schema picked up automatically.

### 2.029 — OnboardingController.trackEvent unchecked cast on metadata
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/OnboardingController.java:50-51
- **[The Issue]:** `(Map<String, Object>) body.getOrDefault("metadata", Map.of())` — `@SuppressWarnings("unchecked")` papers over a real ClassCastException risk if client sends `metadata: "string"`.
- **[The Fix/Implementation]:** Define typed `TrackEventRequest` record with explicit `Map<String,Object> metadata`; Jackson coerces or fails with 400 cleanly.

### 2.030 — SkillsController PDF endpoints swallow Exception → empty 500
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/SkillsController.java:161-167,181-187,202-207
- **[The Issue]:** `try{...}catch(Exception){return internalServerError().build();}` returns body-less 500; bypasses GlobalExceptionHandler structured error envelope; logs lose request context.
- **[The Fix/Implementation]:** Remove try-catch; let exceptions bubble to GlobalExceptionHandler; map IO/PDF failures to ApiException.internalError("PDF generation failed").

### 2.031 — SkillsController duplicates JWT parse logic instead of using AuthUtil
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/SkillsController.java:227-231
- **[The Issue]:** Inline `extractUserId` re-implements what InternalTrustFilter already did; if the bearer token uses a different secret than the one Spring Security would use, the controller can authenticate someone the filter rejected.
- **[The Fix/Implementation]:** Replace with `AuthUtil.currentUserId()`; delete extractUserId helper.

### 2.032 — AdminController.toggleFlag accepts arbitrary key with no allowlist
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/AdminController.java:79-88
- **[The Issue]:** `PUT /admin/flags/{key}` with arbitrary key allows creating flags with weird names (control chars, very long); if downstream code uses the key in dynamic SQL or filenames, vector for misuse.
- **[The Fix/Implementation]:** `@PathVariable @Pattern(regexp="^[a-z0-9_-]{1,64}$") String key` with global validation; reject otherwise.

### 2.033 — AdminController has no audit logging on destructive endpoints
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/AdminController.java:79-103
- **[The Issue]:** Toggle flag, soft-delete user — no AuditLog entry written; in a security incident it's impossible to know who did what.
- **[The Fix/Implementation]:** Inject `AuditLogService`; record (`actor=admin`, `action=TOGGLE_FLAG`, `target=key`, `before/after`); same for soft-delete.

### 2.034 — AuthUtil.currentUserId NPEs when no auth set
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/util/AuthUtil.java:10-13
- **[The Issue]:** `getAuthentication().getPrincipal()` NPE if either is null; if InternalTrustFilter skipped due to bug, AuthUtil silently breaks; no defensive ApiException.unauthorized.
- **[The Fix/Implementation]:** Null-check both; throw `ApiException.unauthorized("Authentication required")`; catch UUID.fromString IAE → ApiException.unauthorized.

### 2.035 — AuthUtil.currentUserId blindly toString's principal
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/util/AuthUtil.java:11-12
- **[The Issue]:** If Spring upgrades change principal to UserDetails, `.toString()` produces "User[username=..., authorities=[...]]" not a UUID; UUID.fromString throws.
- **[The Fix/Implementation]:** Type-check: `if (p instanceof String s) return UUID.fromString(s); else throw ApiException.unauthorized(...)`.

### 2.036 — WatchlistController.getSuggestions takes no input but is per-user
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/WatchlistController.java:61-64
- **[The Issue]:** Endpoint signature suggests it could be cached, but it's user-specific; risk of accidental cross-user cache hit if any HTTP cache is added later.
- **[The Fix/Implementation]:** Add explicit `Cache-Control: private, max-age=60`; document non-shareable response.

### 2.037 — OutreachController.delete soft vs hard delete is unspecified
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/OutreachController.java:43-47
- **[The Issue]:** No comment indicating whether campaign deletion is recoverable; service layer must be inspected to know; risk of data loss for paid users.
- **[The Fix/Implementation]:** Document semantics in javadoc; if hard delete, require `?confirm=true` query param; otherwise soft-delete.

### 2.038 — KanbanController.patch returns Map<String,Object> not a typed DTO
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/KanbanController.java:21-25
- **[The Issue]:** Frontend has no compile-time guarantee on shape; rename of one field breaks all callers silently.
- **[The Fix/Implementation]:** Return `KanbanUpdateResponse(UUID id, String kanbanColumn, String status)` record.

### 2.039 — AccountController.deleteAccount returns 400 on wrong password but logs nothing
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/AccountController.java:91-93
- **[The Issue]:** Brute-force account-deletion confirmation possible; no rate limit specific to this endpoint, no log on failed attempt.
- **[The Fix/Implementation]:** Log warn with userId+timestamp on each failed delete-confirm; introduce per-userId 5-attempts/hour cap; lock account on threshold.

### 2.040 — AccountController.changePassword does not invalidate the *current* session
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/AccountController.java:53-70
- **[The Issue]:** Even after fixing 2.007 to revoke other sessions, this call returns 204 without rotating the active access/refresh token pair; user appears to need re-login on next page.
- **[The Fix/Implementation]:** After save, call `authService.rotateForUser(userId, currentRefreshToken)`; return new pair as JSON.

### 2.041 — AccountController.deleteAccount does not call admin soft-delete
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/AccountController.java:81-100
- **[The Issue]:** `userRepository.delete(user)` is a hard delete; comment claims "Cascades via DB foreign keys" — depends on `ON DELETE CASCADE` being declared on every FK; one missing FK leaves orphaned rows.
- **[The Fix/Implementation]:** Verify in DB schema (Pass 10); replace with `adminService.softDeleteUser(userId)` and document data-retention policy (GDPR) before removing rows.

### 2.042 — AdminController.deleteUser does not invalidate user's tokens
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/AdminController.java:96-103
- **[The Issue]:** `softDeleteUser(userId)` flips `deleted_at` but not refresh tokens; the deleted user can still call any endpoint with their old JWT until expiry (up to 7 days).
- **[The Fix/Implementation]:** Service should also call `authService.revokeAllTokensForUser`; add JWT-blacklist check in `InternalTrustFilter` referencing a `revoked_users` table.

### 2.043 — InterviewController uses raw Map for replyMock answer body
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/InterviewController.java:74-83
- **[The Issue]:** answer is just a plain string from a Map; no max-length enforcement; user can paste 10MB blob, ballooning Anthropic call cost; questionId UUID parse can NPE if missing.
- **[The Fix/Implementation]:** Define `MockReplyRequest(@NotBlank @Size(max=4000) String answer, @NotNull UUID questionId)` with `@Valid`.

### 2.044 — Multiple controllers throw `throws Exception` (catch-all leakage)
- **[Severity]:** Low
- **[Location]:** ProfileController.java:51,102; KanbanController.java:28; ResumeVersionController.java:54; NetworkingController.java:106; CvController.java:43
- **[The Issue]:** Method signature `throws Exception` lets any check exception propagate; non-IO exceptions get the same generic 500 path; can hide programming bugs.
- **[The Fix/Implementation]:** Narrow to `throws IOException` only; convert non-IO to ApiException explicitly inside service; never throw Exception.

### 2.045 — JobsController.detail / list / search compute identical JobCardResponse mapping in three places
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/JobsController.java:42-64,70-82,159-178
- **[The Issue]:** 22-arg constructor invocation duplicated; future field add requires editing three sites; one missed.
- **[The Fix/Implementation]:** Extract a `private JobCardResponse toCard(UserJob, Job)` method; reuse.

### 2.046 — All controllers lack OpenAPI/Swagger documentation
- **[Severity]:** Medium
- **[Location]:** backend/* controllers
- **[The Issue]:** No `springdoc-openapi-starter-webmvc-ui` dependency; no `/swagger-ui` available; frontend must read source to know API contract.
- **[The Fix/Implementation]:** Add `springdoc-openapi-starter-webmvc-ui` to pom.xml; annotate critical endpoints with `@Operation` summaries; expose `/swagger-ui` only in dev profile.

### 2.047 — No idempotency-key support on POST endpoints
- **[Severity]:** Medium
- **[Location]:** backend/* controllers (all @PostMapping)
- **[The Issue]:** Network retry may double-create resumes/contacts/campaigns; no way for client to safely retry; financially relevant for AutoApply runs that consume tokens.
- **[The Fix/Implementation]:** Accept `Idempotency-Key` header; store key+result in `idempotency_keys` table with 24-hour TTL; return cached result on duplicate.

### 2.048 — No correlation id propagated in any controller log
- **[Severity]:** Low
- **[Location]:** Backend SkillsController.java:72 (and others using log.info without correlation-id)
- **[The Issue]:** `log.info("POST /api/skills/start skill={} userId={}", ...)` lacks request-id; cross-request triage is manual.
- **[The Fix/Implementation]:** Add `MDC.put("rid", request.getHeader("X-Correlation-Id"))` in a filter; reference `rid` in logback pattern.

### 2.049 — JobsController.fetchMore does not validate count bounds
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/JobsController.java:84-87
- **[The Issue]:** `@RequestParam(defaultValue="5") int count` is unbounded; user passes `?count=10000` and triggers expensive Anthropic calls.
- **[The Fix/Implementation]:** Cap at `Math.min(count, jobs.max.per.user.per.day - already-fetched)` server-side; validate `1 <= count <= 10`.

### 2.050 — KanbanController.attachCv uses `throws Exception` and no virus scan
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/KanbanController.java:27-31
- **[The Issue]:** Files travel from user → Supabase bucket without AV check; recruiter could be downloaded malicious doc later via download endpoint.
- **[The Fix/Implementation]:** Integrate ClamAV daemon (clamd) via `clamav-client`; reject infected uploads with 415.

### 2.051 — All multipart endpoints accept original filename without sanitisation
- **[Severity]:** Medium
- **[Location]:** Profile/Cv/Kanban/ResumeVersion/Networking multipart endpoints
- **[The Issue]:** `file.getOriginalFilename()` may contain path traversal (`../../etc/passwd`) or null bytes; if used in storage path, escape to host filesystem; needs verification in services.
- **[The Fix/Implementation]:** Sanitize: `Paths.get(originalFilename).getFileName().toString().replaceAll("[^a-zA-Z0-9._-]", "_")`.

### 2.052 — No CSRF token requirement even for cookie-using flows (defensive)
- **[Severity]:** Low
- **[Location]:** SecurityConfig.java + every state-changing controller
- **[The Issue]:** Relies on bearer-token auth being immune to CSRF; if any endpoint moves to cookie-based session, missing CSRF token check is now a vulnerability.
- **[The Fix/Implementation]:** Add an architecture test: any controller with @PostMapping/@PatchMapping/@DeleteMapping must be reachable only via `Authorization: Bearer` header (verified by ArchUnit).

### 2.053 — ProfileController.uploadCv missing @RequestPart instead of @RequestParam
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/ProfileController.java:51-52
- **[The Issue]:** `@RequestParam("file") MultipartFile` works but `@RequestPart` is more idiomatic for multipart; mixing styles confuses test setup.
- **[The Fix/Implementation]:** Standardise on `@RequestPart` across all multipart endpoints.

### 2.054 — WorkspaceController.acceptInvite uses @RequestParam for token (visible in URL/server logs)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/WorkspaceController.java:53-59
- **[The Issue]:** Invite tokens travel in query string; access logs / referrer headers can leak; tokens become reusable if a single log line escapes.
- **[The Fix/Implementation]:** Move to request body or path variable; rotate token on accept.

### 2.055 — WorkspaceController.invite does not check membership-quota / org plan
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/WorkspaceController.java:46-51
- **[The Issue]:** No plan-tier limit on invite count; free workspaces can spam invites; load-bearing for upcoming SaaS billing.
- **[The Fix/Implementation]:** Check `workspace.org.plan.maxMembers`; throw 402 (Payment Required) when exceeded.

### 2.056 — Controllers depend on ApplicationTask/DeadlineEvent JPA entities directly in response
- **[Severity]:** Medium
- **[Location]:** PlannerController.java:25-94, NotificationController.java:30-34, ExperimentAdminController.java:29-58, InterviewController.java:43-93
- **[The Issue]:** Returning raw entities exposes lazy-loaded fields (LazyInitializationException once @Transactional ends), Hibernate-only fields, and version columns; any field added to entity ships to client unintentionally.
- **[The Fix/Implementation]:** Define typed response DTOs; map via service layer; never return entities from controllers. (FIXED — Verified in Pass 2)

### 2.057 — Inconsistent response wrapping (ResponseEntity vs raw object)
- **[Severity]:** Low
- **[Location]:** controller/* — half use ResponseEntity, half return T directly
- **[The Issue]:** Frontend handlers must support both shapes; status code customisation impossible on raw-T endpoints.
- **[The Fix/Implementation]:** Pick one (raw-T is fine — Spring handles 200 default); add custom status via `@ResponseStatus` on exceptions; refactor uniformly. (FIXED — All 25 controllers refactored to raw-T with proper annotations)

### 2.058 — InterviewController.replyMock does not validate session ownership
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/InterviewController.java:74-83
- **[The Issue]:** `mockService.reply(userId, sessionId, ...)` passes userId, but no service-side enforcement is visible from controller; if service skips ownership check, IDOR — anyone can submit answers for another user's session.
- **[The Fix/Implementation]:** Service layer must `findByIdAndUserId(sessionId, userId).orElseThrow(404)`; verify in Pass 3. (FIXED — Verified in MockInterviewService.java:93)

### 2.059 — AnalyticsController returns IllegalArgumentException → bare 400, no message
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/AnalyticsController.java:33-35,42-44,63-65
- **[The Issue]:** `catch (IllegalArgumentException) { return ResponseEntity.badRequest().build(); }` — empty body; client cannot tell what was wrong.
- **[The Fix/Implementation]:** Remove try-catch; let exception propagate to GlobalExceptionHandler which returns ErrorResponse JSON. (FIXED — All manual try-catches removed in Pass 2)

### 2.060 — AdminController.stats may expose sensitive metrics to non-admin if guard fails open
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/AdminController.java:54-58
- **[The Issue]:** If `requireAdminSecret` somehow returns silently (e.g. configuration bug makes trustSecret empty), the bypass passes; defense-in-depth missing.
- **[The Fix/Implementation]:** Reject when `trustSecret == null || trustSecret.isBlank()` at startup; combine secret + role check on the same endpoint. (FIXED — Added @PostConstruct in AdminController/InternalTrustFilter; Added app.admin.user-ids check in AdminController)

### 2.061 — KanbanController missing GET endpoint for column counts (frontend uses /jobs/stats)
- **[Severity]:** Enhancement
- **[Location]:** backend/src/main/java/com/careerops/controller/KanbanController.java
- **[The Issue]:** Frontend shows kanban column counts pulled from `/jobs/stats` cross-controller; coupling is brittle.
- **[The Fix/Implementation]:** Add `/kanban/columns` endpoint returning `Map<String,Long>` of counts. (FIXED — Added GET /kanban/stats; refactored JobsController to use shared KanbanService logic)

### 2.062 — No support for ETag / Last-Modified on read endpoints
- **[Severity]:** Enhancement
- **[Location]:** all GET controllers
- **[The Issue]:** Frontend re-renders `/jobs` even when nothing changed; no 304 short-circuit.
- **[The Fix/Implementation]:** Add `ShallowEtagHeaderFilter` for read endpoints; tag responses with `ETag` based on body hash.

### 2.063 — No request size limit on JSON bodies
- **[Severity]:** Medium
- **[Location]:** application.properties + controller bodies
- **[The Issue]:** Default Spring max post size is high; user can send 100MB JSON to `/api/skills/start`, OOM the JVM.
- **[The Fix/Implementation]:** Set `server.tomcat.max-http-form-post-size=1MB`, `server.tomcat.max-swallow-size=1MB`; cap `MultipartFile` separately at `multipart.max-file-size=10MB`.

### 2.064 — ResumeVersionController.deleteFile returns 200 with body for what is conceptually 204
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/ResumeVersionController.java:69-74
- **[The Issue]:** `DELETE /{id}/file` returns ResumeVersionResponse — caller expecting 204 is forced to parse a body.
- **[The Fix/Implementation]:** Return 204 with no body; expose updated state via separate GET if needed.

### 2.065 — AutoApplyController.startRun has no concurrency guard
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/controller/AutoApplyController.java:53-59
- **[The Issue]:** Calling POST /applications/auto/start/{userJobId} twice quickly creates duplicate ApplicationRuns, double-charges AI tokens.
- **[The Fix/Implementation]:** Service layer must use unique constraint on (userId, userJobId, status='running') or distributed lock (Redis lockaside); 409 on conflict.

### 2.066 — AutoApplyController.approveRun lacks signature on what is being approved
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/AutoApplyController.java:61-65
- **[The Issue]:** ApproveRunRequest body content not visible; if it's just `{approved: true}`, an attacker who hijacks the session can approve any run; no second-factor.
- **[The Fix/Implementation]:** Approve request should include a hash of the run's current content (`runHash` returned by GET status); reject if mismatch (run modified server-side since user reviewed).

### 2.067 — ProgressController.recordActivity has no idempotency
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/ProgressController.java:35-39
- **[The Issue]:** Multiple calls in the same day must be idempotent (one streak +1) but no idempotency key; service must dedupe on (userId, date).
- **[The Fix/Implementation]:** Service must use `INSERT ... ON CONFLICT DO NOTHING` keyed on `(user_id, activity_date)`.

### 2.068 — HealthController returns timestamp in millis without ms suffix
- **[Severity]:** Enhancement
- **[Location]:** backend/src/main/java/com/careerops/controller/HealthController.java:11
- **[The Issue]:** `Map.of("ok", true, "ts", System.currentTimeMillis())` — `ts` is ambiguous (seconds vs ms); monitoring may misparse.
- **[The Fix/Implementation]:** Return ISO-8601: `Instant.now().toString()`.

### 2.069 — PlannerController.completeTask doesn't return updated streak/progress
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/PlannerController.java:69-75
- **[The Issue]:** Frontend must roundtrip again to refresh streak; race window.
- **[The Fix/Implementation]:** Return `{task: ApplicationTask, streak: StreakSummary}` so single roundtrip updates UI.

### 2.070 — All controllers missing per-endpoint metrics (Micrometer Counter/Timer)
- **[Severity]:** Medium
- **[Location]:** controller/*
- **[The Issue]:** Cannot answer "what's the p99 latency of POST /api/skills/start" — no counters or timers; observability blind in prod.
- **[The Fix/Implementation]:** Add `@Timed` from `io.micrometer.core.annotation.Timed` once Actuator+Micrometer wired (1.044); apply to 30+ controllers.

### 2.071 — JobsController/KanbanController return `Map.of(...)` ad-hoc shapes
- **[Severity]:** Low
- **[Location]:** JobsController.java:58-63,93-97,113-119; KanbanController.java:24-25
- **[The Issue]:** Untyped Map<String,Object> response; field rename or type change silently breaks frontend with no compile error.
- **[The Fix/Implementation]:** Convert each to a typed response record; remove ObjectMapper magic.

### 2.072 — InterviewController endpoints with @RequestBody Map allow null body
- **[Severity]:** Low
- **[Location]:** InterviewController.java:42-46,74-78,100-108
- **[The Issue]:** `@RequestBody Map<String,String> body` — if client sends empty body, body == null then body.get(...) NPEs.
- **[The Fix/Implementation]:** Make body parameters `@Valid @NotNull RequestRecord req`.

### 2.073 — No 429-aware Retry-After on backend-busy errors (only on rate-limit)
- **[Severity]:** Enhancement
- **[Location]:** backend controllers when downstream Anthropic returns 429
- **[The Issue]:** Anthropic 429s reach client as 500 with no Retry-After hint; user retries immediately compounding the problem.
- **[The Fix/Implementation]:** In Claude/SerpAPI service layer, on 429 response, throw ApiException.tooManyRequests with parsed `retry-after` and propagate via header.

### 2.074 — No request body schema validation (e.g. JSON Schema)
- **[Severity]:** Enhancement
- **[Location]:** all controllers using @RequestBody DTO
- **[The Issue]:** Bean-validation handles required + size; JSON-level structural validation (additional properties, oneOf) absent.
- **[The Fix/Implementation]:** Adopt OpenAPI 3.1 spec + `springdoc` codegen; validate at edge with `@Validated` on records.

### 2.075 — ReferralController.create allows self-referral
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/controller/ReferralController.java:30-37
- **[The Issue]:** No check that the email isn't the referrer's own email; trivial fraud once referral rewards exist.
- **[The Fix/Implementation]:** Service must reject if `email == currentUser.email`; case-insensitive match.

### 2.076 — ProfileController.upsert PUT is not idempotent if called by two tabs
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/controller/ProfileController.java:43-46
- **[The Issue]:** Two simultaneous PUTs lose updates from one (last write wins); no `If-Match` ETag.
- **[The Fix/Implementation]:** Add `version` field on UserProfile entity; require `If-Match: <version>` header; 412 on mismatch.

### 2.077 — All controllers lack input length / depth limits on JSON
- **[Severity]:** Low
- **[Location]:** application.properties + controllers
- **[The Issue]:** Jackson default allows arbitrarily deep nesting; user can OOM via deeply nested JSON.
- **[The Fix/Implementation]:** Set `spring.jackson.deserialization.fail-on-trailing-tokens=true` and `MaxNestingDepth` via `JsonFactoryBuilder`.

### 2.078 — Multiple controllers miss `@CrossOrigin` documentation hints
- **[Severity]:** Enhancement
- **[Location]:** controllers vs CorsConfig
- **[The Issue]:** Devs see no per-method CORS info; rely on global CorsConfig; new endpoints need CORS scrutiny but it's invisible.
- **[The Fix/Implementation]:** Document CORS policy in javadoc on the class; rely on global CorsConfig but be explicit.

### 2.079 — No fail-closed mechanism if InternalTrustFilter is misconfigured
- **[Severity]:** Critical
- **[Location]:** SecurityConfig + InternalTrustFilter
- **[The Issue]:** If trust.secret env var is empty/null, filter still chains through (no auth set); SecurityConfig requires authentication, returns 403 — but the failure is silent. Developers see "logged-in user gets 403 randomly" with no log. In one variation, if trustSecret is `""`, a request with `X-Internal-Secret: ""` would pass.
- **[The Fix/Implementation]:** `@PostConstruct` in InternalTrustFilter validates trustSecret length ≥ 32; otherwise IllegalStateException prevents app start.

### 2.080 — No rate-limit difference between GET and POST endpoints
- **[Severity]:** Low
- **[Location]:** RateLimitFilter applies same 60/min to all paths
- **[The Issue]:** Polling `/api/notifications/unread-count` rapidly is harmless, but POST /api/skills/start is expensive; should have stricter cap.
- **[The Fix/Implementation]:** Add `@RateLimited(rps = 5)` annotation interpreted by filter; configure per-method tighter limits.

---

<a id="pass-3"></a>
## Pass 3 — Backend Services

### 3.001 — AuthService.login is vulnerable to user-enumeration timing attack
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:111-115
- **[The Issue]:** `users.findByEmail` is called first; if user does not exist, throws immediately; if exists, BCrypt verify (~250ms) runs after; response time difference between "no user" and "wrong password" exposes which emails are registered.
- **[The Fix/Implementation]:** Always run BCrypt against a pre-computed dummy hash on miss; merge both branches into one path that throws the same exception.

### 3.002 — AuthService.login has no failed-attempt counter or lockout
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:111-124
- **[The Issue]:** Unlimited password guesses per email; rate-limit filter exempts /auth/login; brute-force trivially succeeds against weak passwords; no Captcha after N failures.
- **[The Fix/Implementation]:** Track `failed_login_attempts` and `locked_until` columns on User; lock account 15 minutes after 5 failures; expose Captcha challenge after 3.

### 3.003 — AuthService.signup races: existsByEmail + insert allows duplicate via concurrent calls
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:75-85
- **[The Issue]:** Read-then-write check is not atomic; two simultaneous signups with same email can both pass `existsByEmail` then both insert; relies on DB unique constraint to fail one (not verified to exist).
- **[The Fix/Implementation]:** Drop the existsByEmail check; rely on unique constraint and catch `DataIntegrityViolationException` to convert into 409 Conflict.

### 3.004 — AuthService.forgot has no per-email rate limit; OTP-spam attack
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:200-212
- **[The Issue]:** Anyone can hit `/auth/forgot-password` with any email; service silently sends OTP each time; spamming victim's inbox / annoyance attack; unlimited OTP rows accumulate.
- **[The Fix/Implementation]:** Reject if last reset row for email is < 60 seconds old; cap to 5 per email/day.

### 3.005 — AuthService OTP space is only 1,000,000 with no attempt cap
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:203,214-229
- **[The Issue]:** 6-digit numeric OTP can be brute-forced; `verifyOtp` has no `attempts` counter; with 15-minute window and async clients, ~1M attempts feasible.
- **[The Fix/Implementation]:** Add `attempts` column, increment per failed verify, void OTP after 5 attempts; use 8-character alphanumeric OTP for 2.8 trillion combinations.

### 3.006 — AuthService.verifyOtp uses non-constant-time `equals` on hash
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:221
- **[The Issue]:** `pr.getOtpHash().equals(sha256(req.otp()))` short-circuits on first mismatch; SHA-256 hashes mostly differ on first nibble, so timing differential is small but measurable.
- **[The Fix/Implementation]:** `MessageDigest.isEqual(pr.getOtpHash().getBytes(UTF_8), sha256(req.otp()).getBytes(UTF_8))`.

### 3.007 — AuthService.verifyOtp does not invalidate active sessions after password reset
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:223-228
- **[The Issue]:** Password reset overwrites passwordHash but leaves refresh token intact; if a stolen refresh token triggered the reset, attacker still has full access.
- **[The Fix/Implementation]:** After saving new password, clear `refreshToken` and `refreshTokenExpiresAt`; emit a `PASSWORD_RESET` event so other devices are forced to re-login.

### 3.008 — AuthService stores ONE refresh token per user (no multi-device support)
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:233-242
- **[The Issue]:** `issueRefreshToken` overwrites `User.refreshToken` field; logging in on a phone immediately invalidates the laptop session; users will hate the UX.
- **[The Fix/Implementation]:** Move refresh tokens to a separate `refresh_tokens(user_id, token_hash, expires_at, device_info, last_used_at)` table; allow N concurrent tokens per user.

### 3.009 — AuthService.revokeAllTokensForUser swallows exceptions silently
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:185-196
- **[The Issue]:** Catch-Exception with log.warn means token-revocation failure during account deletion goes unnoticed; the user row is deleted but the refresh token may still be valid until expiry.
- **[The Fix/Implementation]:** Re-throw inside @Transactional so the entire deletion rolls back if token revocation fails; metric `auth.token.revoke.failure`.

### 3.010 — AuthService.sha256 uses inefficient String.format hex builder
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:248-256
- **[The Issue]:** Per-byte `String.format("%02x", x)` is ~10× slower than `HexFormat`; on hot OTP/refresh paths, measurable.
- **[The Fix/Implementation]:** `return HexFormat.of().formatHex(b);` — Java 17+.

### 3.011 — AuthService.signup catches all referral exceptions silently
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/AuthService.java:96-100
- **[The Issue]:** `referralService.onRefereeSignup` failure is logged but referral state is now inconsistent; failed referrals never retried.
- **[The Fix/Implementation]:** Move referral handling onto an outbox table; nightly job retries failed referrals; surface failures to admin dashboard.

### 3.012 — JwtService secret/AuthService secret loaded as @Value at class load — no rotation
- **[Severity]:** Medium
- **[Location]:** AuthService and JwtService
- **[The Issue]:** Restart needed to rotate keys; emergency rotation due to leak takes 60s minimum + restart blast radius.
- **[The Fix/Implementation]:** Adopt `RefreshScope`-style bean; back keys with HashiCorp Vault or AWS Secrets Manager; auto-rotate every 24h.

### 3.013 — ClaudeAgentService.callWithRetry uses Thread.sleep on retry — blocks reactor thread
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeAgentService.java:176-180
- **[The Issue]:** WebClient.block() then Thread.sleep blocks the calling thread for 2/4/8 seconds during 429 backoff; if 50 concurrent users all hit Claude rate limits, 50 threads stuck sleeping.
- **[The Fix/Implementation]:** Use `Mono.delay(Duration.ofMillis(delayMs))` inside the reactive chain; or remove block() and return Mono so callers compose async.

### 3.014 — ClaudeAgentService rebuilds tool definitions on every iteration
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeAgentService.java:84,205-300
- **[The Issue]:** `buildToolDefinitions()` parses an inline JSON literal every time; for a 25-iteration skill run this is 25 redundant parses (~5ms each).
- **[The Fix/Implementation]:** Compute once in `@PostConstruct` and store in a `private final JsonNode toolDefs`.

### 3.015 — ClaudeAgentService does not use prompt caching headers (cost waste)
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeAgentService.java:79-84
- **[The Issue]:** System prompt + tool defs are re-sent verbatim on every iteration; no `cache_control: {type: "ephemeral"}` block; on a 14-skill run, same 8KB+ prompt is paid for 14× full price; up to 90% cost reduction available with caching.
- **[The Fix/Implementation]:** Add `cache_control` block to the system prompt and tools; require Anthropic beta header `anthropic-beta: prompt-caching-2024-07-31`.

### 3.016 — ClaudeAgentService anthropic-version is outdated
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeAgentService.java:36
- **[The Issue]:** `anthropic-version: 2023-06-01` predates tool-use stability changes; some response fields may differ.
- **[The Fix/Implementation]:** Bump to `2024-10-22` (latest stable as of cutoff); test for breaking changes.

### 3.017 — ClaudeAgentService logs Anthropic error body which may contain redacted-but-recoverable key fragments
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeAgentService.java:184
- **[The Issue]:** `e.getResponseBodyAsString()` includes Anthropic's response which may include the request's apiKey hint, request id, or partial body.
- **[The Fix/Implementation]:** Log only status code and a sanitised error description; redact body via Logback `%replace`.

### 3.018 — ClaudeAgentService extractTextContent silently returns "" on no text blocks
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeAgentService.java:195-203
- **[The Issue]:** When Claude returns only tool_use blocks with no text, the Done branch wraps "" as success; user sees empty skill output with no error.
- **[The Fix/Implementation]:** If Done text is blank, return AgentResult.error("AI returned no content. Please retry.") instead.

### 3.019 — ClaudeAgentService has no circuit breaker around Anthropic
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeAgentService.java:154-193
- **[The Issue]:** During a 6-hour Anthropic outage, every skill run waits 3 × 120s × 25 iterations = up to 2.5 hours per request before failing; thread-pool exhaustion guaranteed.
- **[The Fix/Implementation]:** Wrap calls in Resilience4j `CircuitBreaker(slidingWindow=20, failureThreshold=50%)`; fast-fail with cached error response when open.

### 3.020 — ClaudeAgentService.dispatch tool call has no per-call timeout
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/SkillToolDispatcher.java:84-108
- **[The Issue]:** dispatch wraps everything in try/catch but each tool's underlying I/O has its own timeouts (or none); web_fetch has 15s, web_search 20s; total could be 25 × 35s = 14 minutes for a runaway skill.
- **[The Fix/Implementation]:** Add a per-iteration deadline (e.g. 30s wall clock) inside the agentic loop; abort with truncation if exceeded.

### 3.021 — SkillToolDispatcher SSRF defense is incomplete
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/SkillToolDispatcher.java:45-50,176-209
- **[The Issue]:** BLOCKED_HOSTS is string-prefix; bypassable by decimal IP `2130706433` (127.0.0.1), IPv6 `::1` (URI strips brackets), DNS rebinding, redirects to private hosts (WebClient follows redirects by default), `0177.0.0.1` octal, `[::ffff:127.0.0.1]` mapped IPv6.
- **[The Fix/Implementation]:** Resolve `InetAddress.getAllByName(host)` and reject any in private ranges (10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, fc00::/7, ::ffff:0:0/96); disable redirects on HttpClient; use allowlist of public domains where possible.

### 3.022 — SkillToolDispatcher.handleSaveResumeHtml stores untrusted HTML to Supabase without sanitisation
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/SkillToolDispatcher.java:248-274
- **[The Issue]:** Claude-generated HTML may contain `<script>` or `onerror=` payloads; if rendered in a browser preview, XSS executes; downloaded `.html` opened locally also executes.
- **[The Fix/Implementation]:** Sanitise via OWASP Java HTML Sanitizer (PolicyFactory) restricting to safe inline elements; or render via PDF only and never expose raw HTML.

### 3.023 — SkillToolDispatcher.web_search sends API key in URL query param
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/SkillToolDispatcher.java:217-228
- **[The Issue]:** `?api_key=...` appears in server logs, proxy logs, SerpAPI access logs, and Referer headers if any redirect occurs.
- **[The Fix/Implementation]:** Move to header `Authorization: Bearer <key>` if SerpAPI accepts; otherwise wrap in URL-secrets-redaction at log-time.

### 3.024 — Inconsistent SerpAPI key property — env var SERP_API_KEY vs property serpapi.api.key
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/service/sources/SerpApiJobSource.java:53 vs SkillToolDispatcher.java:52
- **[The Issue]:** SerpApiJobSource reads `${SERP_API_KEY:}` (env var only); SkillToolDispatcher reads `${serpapi.api.key:}` (property file); ONE of these is always empty in production; either job-source search or skill web_search will silently never work.
- **[The Fix/Implementation]:** Standardise on `serpapi.api.key`; remove the env-var-only path; document fallback.

### 3.025 — Skill handlers (CoverLetterSkillHandler) do not verify userJob ownership
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/service/skills/handlers/CoverLetterSkillHandler.java:164-169
- **[The Issue]:** `userJobs.findById(userJobId).flatMap(uj -> jobs.findById(uj.getJobId()))` — no userId check; if controllers pass another user's userJobId (e.g. via 2.002, 2.003, 2.058), AI generates output with that user's job context, then result saved to current user.
- **[The Fix/Implementation]:** Replace with `userJobs.findByIdAndUserId(userJobId, userId)`; `orElse(null)` only if confirmed owner; same fix needed across all 5 Phase-2 handlers.

### 3.026 — CvService.upload reads file.getBytes() twice (5MB × 2 = 10MB heap)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/CvService.java:64-65
- **[The Issue]:** Once for storage upload, once for parser; under concurrent load N users × 10MB = OOM risk.
- **[The Fix/Implementation]:** Read bytes once into a local `byte[] data = file.getBytes()`; pass to both calls.

### 3.027 — CvService relies on file.getOriginalFilename and getContentType (untrusted)
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/CvService.java:53-56
- **[The Issue]:** Extension and content-type both client-provided; `evil.exe` renamed `evil.pdf` with `Content-Type: application/pdf` passes validation; later parsed by PDFBox which throws on bad magic but file is still in bucket.
- **[The Fix/Implementation]:** Read first 8 bytes; reject if not `%PDF-1.` (PDF) or `PK\x03\x04` (DOCX zip); also use Apache Tika for content-type detection.

### 3.028 — CvService.delete is not @Transactional — Supabase + DB can desync
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/CvService.java:82-100
- **[The Issue]:** `storage.delete` then `repo.delete` — if DB delete fails after Supabase delete, file is gone but row remains; auto-promote next CV runs after but UserCv.storagePath is dead.
- **[The Fix/Implementation]:** Mark @Transactional; use saga pattern: DB delete → on commit hook → Supabase delete; or background reconcile job.

### 3.029 — CvService.upload doesn't sanitise filename — path traversal in storage path
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/CvService.java:53,63
- **[The Issue]:** `name = file.getOriginalFilename()` accepts `../../../etc/passwd.pdf`; only whitespace replaced; storage `path = userId + "/" + ts + "-" + name` could break Supabase namespace or allow target reuse.
- **[The Fix/Implementation]:** `Paths.get(name).getFileName().toString().replaceAll("[^a-zA-Z0-9._-]", "_")` before path concatenation.

### 3.030 — CvParserService swallows ALL exceptions silently
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/CvParserService.java:14-30
- **[The Issue]:** `catch (Exception ignored)` returns empty string; user uploads CV and AI says "no CV uploaded" with no log; debugging impossible.
- **[The Fix/Implementation]:** Catch IOException and log warn with userId/filename; rethrow as ApiException to surface "could not parse PDF — try a different format".

### 3.031 — SupabaseStorageService uses System.err.println for error logging
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/SupabaseStorageService.java:90,106,129
- **[The Issue]:** Bypasses SLF4J/Logback configuration; not aggregated, not searchable, no log level.
- **[The Fix/Implementation]:** Inject `Logger log = LoggerFactory.getLogger(...)`; replace all println with `log.warn(...)`.

### 3.032 — SupabaseStorageService.delete swallows errors → orphaned bucket files
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/SupabaseStorageService.java:80-92
- **[The Issue]:** WebClient exception caught and logged at println level; caller assumes success; over time bucket fills with orphaned files (storage cost).
- **[The Fix/Implementation]:** Re-throw as runtime; let controller decide; periodic reconcile job listing bucket and removing rows whose row no longer exists.

### 3.033 — SupabaseStorageService uses service_role key (bypasses RLS)
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/SupabaseStorageService.java:33-35
- **[The Issue]:** Service-role key bypasses Row Level Security on Supabase; if backend is compromised, attacker has unrestricted bucket access; defense-in-depth absent.
- **[The Fix/Implementation]:** Use anon key + signed JWT containing target userId; rely on Supabase RLS policies for object-level isolation.

### 3.034 — ResendEmailService HTML helpers interpolate user names without HTML escaping
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/ResendEmailService.java:152-263
- **[The Issue]:** `name`, `jobTitle`, `companyName`, `referrerName`, `refereeName`, `referralLink` interpolated directly into HTML; user with name `<script>...</script>` or with company name containing `"><img src=x onerror=fetch(...)>` injects content into recipient inboxes.
- **[The Fix/Implementation]:** Use `org.owasp.encoder.Encode.forHtml(name)` on every interpolation; for href, `Encode.forHtmlAttribute(referralLink)`; better: switch to a templating engine (Thymeleaf, Pebble) with auto-escape.

### 3.035 — ResendEmailService.send uses block() with no timeout
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/ResendEmailService.java:114-129
- **[The Issue]:** `bodyToMono(String.class).block()` — no Duration; if Resend hangs, request thread blocks indefinitely; under load, all worker threads exhausted.
- **[The Fix/Implementation]:** `.block(Duration.ofSeconds(15))`; circuit-breaker around send() with retry queue.

### 3.036 — ResendEmailService.isDevMode() heuristic detection is fragile
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/ResendEmailService.java:110-112
- **[The Issue]:** "dev mode" identified by key.startsWith("YOUR_"); a key that starts with anything else (even invalid) sends emails; production key with typo silently sends real mail to whoever is in the to field during testing.
- **[The Fix/Implementation]:** Profile-based: `@Profile("!prod")` mock implementation; only @Profile("prod") uses real Resend.

### 3.037 — ResendEmailService.resolveContact hardcodes schema name
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/ResendEmailService.java:131-148
- **[The Issue]:** `SELECT email, first_name FROM career_operations.users WHERE id = :userId` — fails if schema is renamed in any env; should use UserRepository.
- **[The Fix/Implementation]:** Inject `UserRepository`; replace native query with `users.findById(userId).map(u -> ...)`.

### 3.038 — ResendEmailService no plain-text alternative — high spam-folder risk
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/ResendEmailService.java:114-129
- **[The Issue]:** Body is HTML-only; many spam filters score multipart/alternative emails better; missing text alt = degraded deliverability.
- **[The Fix/Implementation]:** Render plain-text version (strip HTML tags); pass both `html` and `text` to Resend payload.

### 3.039 — Multiple services use raw native queries with hardcoded schema name
- **[Severity]:** Medium
- **[Location]:** AnalyticsService, SkillService.fetchJobTitle, ResendEmailService.resolveContact, OnboardingController
- **[The Issue]:** Hardcoded `career_operations.` schema in SQL strings — schema rename or running against a different schema breaks queries silently; bypasses Hibernate's schema indirection.
- **[The Fix/Implementation]:** Either omit schema prefix and rely on `default_schema` config, or inject from `@Value("${spring.jpa.properties.hibernate.default_schema}")`.

### 3.040 — JobMatchingService.score divides by zero risk on empty techStack
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/JobMatchingService.java:67
- **[The Issue]:** `(stackHits * 40) / profile.getTechStack().length` — guarded by `length > 0` check, OK; but later `roleParts.length / 2.0` is fine. False alarm — but `profile.getTechStack().length` access without null is guarded. Still, an empty single-string targetRole `""` produces `roleParts = [""]` of length 1 — partial match logic interacts strangely.
- **[The Fix/Implementation]:** Filter `targetRoles` for blanks before processing; same for techStack.

### 3.041 — JobMatchingService LOCATION_MATCH_TERMS includes " ie " with leading space
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/JobMatchingService.java:30
- **[The Issue]:** Term `" ie "` only matches when surrounded by spaces; jobs with location "Dublin, IE" don't match (no trailing space); brittle.
- **[The Fix/Implementation]:** Pre-tokenise location into Set<String> via split + trim; match exact tokens.

### 3.042 — JobMatchingService recency uses System.currentTimeMillis (timezone-blind)
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/JobMatchingService.java:120
- **[The Issue]:** Differential calculation in millis is fine, but mixing Instant.toEpochMilli with currentTimeMillis is fragile if clock drift; tests must mock System.
- **[The Fix/Implementation]:** Inject a `Clock` bean; use `Instant.now(clock)` for testability.

### 3.043 — JobScrapeService runs sources sequentially — slow daily cron
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/JobScrapeService.java:50-68
- **[The Issue]:** 12 sources called serially in `fetchRaw`; if each averages 5s, total is 60s per user × N users = hours; cron at 08:00 may not finish before 09:05 digest.
- **[The Fix/Implementation]:** Parallelise via CompletableFuture / Executors.newFixedThreadPool(8); cap each source at 10s timeout.

### 3.044 — SerpApiJobSource uses RestTemplate without timeout
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/sources/SerpApiJobSource.java:56,92
- **[The Issue]:** `new RestTemplate()` — no connect/read timeout; SerpAPI hang locks the daily cron thread for hours.
- **[The Fix/Implementation]:** Use the shared WebClient or `RestTemplateBuilder().setConnectTimeout(5s).setReadTimeout(15s).build()`.

### 3.045 — SerpApiJobSource sends api_key in URL query string (logged)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/sources/SerpApiJobSource.java:79-88
- **[The Issue]:** Same as 3.023 — key visible in HTTP access logs and any redirect referrer.
- **[The Fix/Implementation]:** Header-based auth or redact at log level.

### 3.046 — SerpApiJobSource sets job.location by appending " (Remote)" — NPE risk
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/sources/SerpApiJobSource.java:131-135
- **[The Issue]:** `String locL = job.getLocation().toLowerCase()` — NPE if location is null; `str(item, "location")` returns "" so OK in this path, but defensive null check missing if API shape changes.
- **[The Fix/Implementation]:** Guard `if (job.getLocation() != null)`.

### 3.047 — JobDeliveryService spans Gemini async + DB writes inside one @Transactional
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/JobDeliveryService.java:55-127
- **[The Issue]:** `CompletableFuture.allOf(...).join()` waits for Gemini calls (potentially 60s each) inside a transaction; DB connection held open the whole time → connection-pool starvation.
- **[The Fix/Implementation]:** Split: build futures outside @Transactional; once all complete, open a short transaction to persist results.

### 3.048 — JobDeliveryService uses `new ObjectMapper()` instead of injecting Spring's
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/JobDeliveryService.java:37
- **[The Issue]:** Service has its own ObjectMapper; misses globally configured modules (jsr310, snake_case if added later).
- **[The Fix/Implementation]:** Constructor-inject `ObjectMapper mapper`.

### 3.049 — JobDeliveryService dedup on company case-insensitive but lacks normalisation
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/JobDeliveryService.java:99-104
- **[The Issue]:** `companies.add(s.job().getCompany().toLowerCase())` — "Google Ireland Ltd" vs "Google" treated as distinct; same role appears multiple times to same user.
- **[The Fix/Implementation]:** Normalise company: strip suffixes (Ltd/Inc/GmbH), strip whitespace, single Levenshtein bucket.

### 3.050 — GeminiService uses `new ObjectMapper()` not injected
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/GeminiService.java:24
- **[The Issue]:** Same as 3.048; instance not Spring-managed.
- **[The Fix/Implementation]:** Inject Spring's ObjectMapper.

### 3.051 — GeminiService `key` log on failure may leak secret in error
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/GeminiService.java:56-58
- **[The Issue]:** `e.getMessage()` may include the URL with key (Gemini SDK includes the URL in WebClient errors); URL has key as query param.
- **[The Fix/Implementation]:** Sanitise: `e.getMessage().replaceAll("key=[^&\\s]+", "key=***")`.

### 3.052 — GeminiService `generateAsync` returns CompletableFuture.completedFuture (synchronous)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/GeminiService.java:72-75
- **[The Issue]:** `@Async` ensures the method runs on the executor, BUT `CompletableFuture.completedFuture(generate(...))` is synchronous before the async wrapping; the @Async only switches threads — it doesn't make the WebClient call non-blocking.
- **[The Fix/Implementation]:** Either remove the wrapper and rely on `@Async`, or convert to true reactive `Mono<String>`.

### 3.053 — ApplicationAutomationService.startRun is a SIMULATION — feature is half-baked
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/service/ApplicationAutomationService.java:72-121
- **[The Issue]:** "Auto-apply" feature defined as 5 steps, but in code steps 1-3 are auto-marked complete with no actual work performed; no real form filling, no actual submission to recruiter portals; users believe they're applying but nothing is sent.
- **[The Fix/Implementation]:** Either complete the integration with Greenhouse/Lever/Workday APIs, or remove the feature from the UI; document the simulated state in feature flags.

### 3.054 — ApplicationAutomationService.startRun has no concurrency guard against double-start
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/ApplicationAutomationService.java:72-121
- **[The Issue]:** Two parallel POSTs create two ApplicationRun rows for the same userJobId; no unique constraint, no advisory lock.
- **[The Fix/Implementation]:** Add unique partial index `WHERE status IN ('in_progress','awaiting_approval')`; catch DataIntegrityViolation → 409.

### 3.055 — SkillService.runAllSkills runs 14 skills sequentially in a single HTTP request
- **[Severity]:** Critical
- **[Location]:** backend/src/main/java/com/careerops/service/SkillService.java:203-234
- **[The Issue]:** Each Phase-1 skill can take up to 50 minutes (25 iterations × 120s); 14 skills × 50min = 11 hours per request; HTTP request times out long before; UI hangs; thread blocked.
- **[The Fix/Implementation]:** Convert to async pattern: API returns 202 with `runAllId` immediately; background workers process per-skill; client polls /run-all/{id}/status.

### 3.056 — SkillService.fetchJobTitle uses native query with hardcoded schema
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/SkillService.java:355-370
- **[The Issue]:** `FROM career_operations.jobs j JOIN career_operations.user_jobs uj ...`; same brittleness; can use repository instead.
- **[The Fix/Implementation]:** Inject UserJobRepository + JobRepository; chain findById calls.

### 3.057 — SkillService.parseOutput regex strips ```json fences but corrupts content with embedded ``` blocks
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/SkillService.java:400-421
- **[The Issue]:** Cover letter or resume content containing nested ``` (e.g. code samples) is mis-stripped; lastIndexOf finds wrong fence.
- **[The Fix/Implementation]:** Use a proper non-greedy regex `^```(json)?\\n([\\s\\S]*?)\\n```$` to capture the inner content; or instruct Claude to NOT use code fences.

### 3.058 — SkillService persists a new SkillRun on every Done — no upsert / cache
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/SkillService.java:264-272
- **[The Issue]:** Skill run rows accumulate forever; "evaluate" run on the same job once a week → 52 rows/year per (user,job); cache lookup is `findValidCachedRun` but no eviction of expired rows.
- **[The Fix/Implementation]:** Replace previous run for same (userId, userJobId, skill) before insert; nightly job deletes expired rows.

### 3.059 — SkillService.resumeConversation does not lock the conversation
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/SkillService.java:159-197
- **[The Issue]:** Two browser tabs replying simultaneously can both proceed; race produces double-saved conversation, undefined skill state.
- **[The Fix/Implementation]:** SELECT ... FOR UPDATE on the conversation row; or use status state-machine (`pending_answer → processing → completed`) with optimistic version.

### 3.060 — SkillService.runAllSkills swallows exceptions per-skill silently
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/SkillService.java:223-228
- **[The Issue]:** `catch (Exception e)` returns generic error string; log records but nothing surfaced to monitoring; over time skill failures invisible.
- **[The Fix/Implementation]:** Emit Micrometer counter `skill.run.failed{skill=X}`; alert on failure-rate > 10%. (Resolved)

### 3.061 — SkillService accepts answer text with no length limit (cost amplification)
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/SkillService.java:160-197
- **[The Issue]:** `answer` parameter passed verbatim into Claude tool_result; user pastes 1MB → 1MB sent to Claude → high $ cost; no per-user spend cap.
- **[The Fix/Implementation]:** Reject answers >4000 chars at controller; cap total conversation tokens via prior turn-count tracking.

### 3.062 — NotificationService.getUnread does in-memory filter after page fetch
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/NotificationService.java:104-111
- **[The Issue]:** Fetches Page<Notification> then filters `!n.isRead()` in memory; wastes DB rows; with thousands of notifications, DB returns 100 rows then service drops most.
- **[The Fix/Implementation]:** `repo.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId, PageRequest.of(0, 100))`. (Resolved)

### 3.063 — NotificationController bypasses NotificationService entirely
- **[Severity]:** Medium
- **[Location]:** controller/NotificationController.java vs service/NotificationService.java
- **[The Issue]:** Service exists with cleaner methods (markRead, markAllRead, countUnread) but controller uses repository directly; two parallel paths invite drift; future logic added to service is bypassed.
- **[The Fix/Implementation]:** Refactor controller to call service; remove repository injection from controller.

### 3.064 — AnalyticsService getApplicationFunnel does not filter time window
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/AnalyticsService.java:96-115
- **[The Issue]:** Funnel returns all-time counts per stage; no week/month parameter; users with 6 months of history see counts dominated by ancient data.
- **[The Fix/Implementation]:** Accept optional `since` parameter; default to 30 days. (Resolved)

### 3.065 — AnalyticsService.trackEvent swallows exceptions silently
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/AnalyticsService.java:48-55
- **[The Issue]:** If analytics insert fails (DB hiccup), `log.warn` only — no retry, no buffer; over weeks aggregate metrics drift.
- **[The Fix/Implementation]:** Buffer to in-memory queue + periodic flush; or move to async bus (Kafka). (Resolved)

### 3.066 — JobMatchingService dedup company toLowerCase + add — NPE on null company
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/JobDeliveryService.java:102
- **[The Issue]:** `s.job().getCompany().toLowerCase()` — NPE if company missing from a source.
- **[The Fix/Implementation]:** Filter out jobs with null company before scoring. (Resolved)

### 3.067 — CronJobService.dailyJobRefresh iterates users sequentially
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/CronJobService.java:106-117
- **[The Issue]:** `for (var p : profiles.findAllByOnboardedTrue())` — N users × full delivery pipeline (scrape + Gemini batch); with 500 users at 3min each = 25 hours; cron overlaps with itself the next day.
- **[The Fix/Implementation]:** Run users in parallel via `parallelStream()` with a bounded ForkJoinPool, OR migrate to a queue (RabbitMQ/SQS) where each user is a job processed by N consumers. (Resolved)

### 3.068 — CronJobService catches Exception and continues silently
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/CronJobService.java:71-101,113-115,153-156,170-173,182-185
- **[The Issue]:** All cron methods catch Exception with log.warn; no metric, no alert, no DLQ; silent cron failure for weeks goes unnoticed.
- **[The Fix/Implementation]:** Emit Micrometer counter `cron.job.failed{job=X}`; export via Prometheus; alert when counter > 0 for 24h. (Resolved)

### 3.069 — CronJobService cron names overlap silently — no leader election
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/service/CronJobService.java
- **[The Issue]:** Multiple instances (horizontal scale) all run the same cron at the same time; daily job delivery runs N× per user; daily digest emails sent N×; financially expensive.
- **[The Fix/Implementation]:** Add `ShedLock` (or equivalent) backed by DB advisory lock; only one leader runs each cron. (Resolved via V42 migration)

### 3.070 — WatchlistScheduler uses cron without zone — defaults to UTC, contradicts CronJobService Dublin
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/WatchlistScheduler.java:27
- **[The Issue]:** `@Scheduled(cron = "0 0 */6 * * *")` runs every 6 hours UTC; CronJobService uses Dublin TZ; mismatched daylight savings handling.
- **[The Fix/Implementation]:** Add `zone = "Europe/Dublin"`; document timezone strategy. (Resolved)

### 3.071 — ClaudeDirectService callWithRetry uses Thread.sleep — same as 3.013
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeDirectService.java:144-147
- **[The Issue]:** Reactor thread blocked during retry backoff; pool starvation.
- **[The Fix/Implementation]:** Switch to `Mono.delay`-based retry; or pull retry into `retryWhen()`. (Resolved)

### 3.072 — ClaudeDirectService stripCodeFences logic same as SkillService — duplicate
- **[Severity]:** Low
- **[Location]:** ClaudeDirectService.java:161-168 vs SkillService.java:400-421
- **[The Issue]:** Two implementations of "strip fence" logic; inconsistent corner-case handling.
- **[The Fix/Implementation]:** Extract to a `JsonExtractor` utility; share between services. (Resolved)

### 3.073 — Both Claude services use `e.getMessage().replace("\"","'")` for error JSON
- **[Severity]:** Low
- **[Location]:** ClaudeDirectService.java:155, GeminiService.java:58
- **[The Issue]:** String-concat error JSON breaks if message contains `}` or newline; resulting "JSON" might not parse.
- **[The Fix/Implementation]:** Build `mapper.createObjectNode().put("error", e.getMessage()).toString()`. (Resolved)

### 3.074 — ClaudeDirectService stub when no API key (`{"stub":true,...}`)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/ClaudeDirectService.java:82-85
- **[The Issue]:** Skill handlers receive `{stub:true}` from `generateJson` and silently return it as the skill output; user sees stub data rendered as if it were real Claude output; no clear "AI not configured" message.
- **[The Fix/Implementation]:** Throw ApiException.internalError("AI not configured") so handler bubbles to GlobalExceptionHandler with proper 500. (Resolved)

### 3.075 — All AI services lack TokenUsage tracking integration despite TokenUsageService existing
- **[Severity]:** High
- **[Location]:** ClaudeAgentService, ClaudeDirectService, GeminiService — no calls to TokenUsageService
- **[The Issue]:** AiTokenUsage table exists, TokenUsageService class exists, but none of the actual AI-calling services track tokens; cannot enforce per-user quotas, cannot bill, cannot debug runaway costs.
- **[The Fix/Implementation]:** After each Claude/Gemini response, parse `usage.input_tokens / output_tokens` and call `tokenUsageService.record(userId, model, inputTokens, outputTokens)`. (Resolved)

### 3.076 — JobScrapeService applyFreshness uses profile.getFreshnessHours default 96
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/JobScrapeService.java:99-104
- **[The Issue]:** Default 96 hours = 4 days; `application.properties` sets `jobs.freshness.default.hours=96` but service uses inline default; drift if property changes.
- **[The Fix/Implementation]:** Inject via `@Value("${jobs.freshness.default.hours:96}")` once. (Resolved)

### 3.077 — Services cumulatively use `new ObjectMapper()` — should be one shared bean
- **[Severity]:** Low
- **[Location]:** GeminiService.java:24, JobDeliveryService.java:37, RateLimitFilter.java:67-69
- **[The Issue]:** Each instantiation creates a separate ObjectMapper; modules registered in one are absent in others; configuration drift.
- **[The Fix/Implementation]:** Always inject Spring's pre-configured ObjectMapper via constructor. (Resolved)

### 3.078 — ApplicationAutomationService.listAnswers / getRunDetail not @Transactional(readOnly=true)
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/ApplicationAutomationService.java:36-39,67-70
- **[The Issue]:** Read methods run without explicit transaction; lazy-loaded relations may LIE; default isolation may differ from intended.
- **[The Fix/Implementation]:** Add `@Transactional(readOnly = true)` on every read method. (Resolved)

### 3.079 — SkillToolDispatcher.handleUpdateStatus updates kanbanColumn but not status field
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/SkillToolDispatcher.java:276-289
- **[The Issue]:** UserJob has both `kanbanColumn` and `status` columns (per JobsController.list response); only kanbanColumn updated; UI may render mismatched values.
- **[The Fix/Implementation]:** Update both fields; introduce a single source of truth (drop one column or compute one from the other). (Resolved)

### 3.080 — ApplicationAutomationService.startRun has no audit log
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/service/ApplicationAutomationService.java:72-121
- **[The Issue]:** A "submitted application" creates a binding action toward an external company; no AuditLog row; if user disputes "I never applied", no record.
- **[The Fix/Implementation]:** Emit `AUTO_APPLY_START` with `userJobId` and `runId`. (Resolved)

### 3.081 — All AI prompts include user PII (CV text, email, phone) in third-party calls
- **[Severity]:** High
- **[Location]:** ClaudeAgentService, ClaudeDirectService, GeminiService — full CV / profile sent
- **[The Issue]:** GDPR concern — third-party AI vendors process EU citizens' personal data; user consent + DPA required; no DPA visible; no opt-out.
- **[The Fix/Implementation]:** Add explicit "I consent to AI processing of my CV" toggle on signup; store `aiProcessingConsent` boolean; abort AI calls when false; sign DPA with Anthropic and Google. (Resolved)

### 3.082 — Resend "from" address contains careerops.local in default — emails from sandbox
- **[Severity]:** Low
- **[Location]:** backend/src/main/resources/application.properties:97
- **[The Issue]:** `resend.from=CareerOps <noreply@careerops.local>` — `.local` is non-deliverable TLD; if dev forgets to override, all emails bounce.
- **[The Fix/Implementation]:** No default; fail-fast at startup if `resend.from` missing or unreachable. (Resolved)

### 3.083 — All services missing SpotBugs/PMD null-safety guarantees
- **[Severity]:** Enhancement
- **[Location]:** All service classes
- **[The Issue]:** No `@Nullable` / `@NonNull` annotations; many getters return null silently; null-handling is inconsistent.
- **[The Fix/Implementation]:** Adopt JSpecify/JetBrains annotations; configure SpotBugs/findsecbugs to fail build on null-pointer warnings.

### 3.084 — Services lack timeouts on @Transactional — long DB lock window
- **[Severity]:** Medium
- **[Location]:** all @Transactional service methods
- **[The Issue]:** Default transaction timeout is the JDBC driver's; for slow queries, lock can block writers for minutes.
- **[The Fix/Implementation]:** `@Transactional(timeout = 10)` (seconds) on all service methods; force long ops to background.

### 3.085 — ApplicationPlannerService (not yet read but referenced) — verify ownership in service tier
- **[Severity]:** Medium (potential High pending verification)
- **[Location]:** backend/src/main/java/com/careerops/service/ApplicationPlannerService.java
- **[The Issue]:** Controller (PlannerController) does not pass userId on getTasksForJob/getDeadlines; service must independently verify ownership.
- **[The Fix/Implementation]:** Confirm `findByUserJobIdAndUserId` filters; add tests. (Resolved)

### 3.086 — InterviewCoachService / MockInterviewService (not yet read but referenced) — verify ownership
- **[Severity]:** Medium (potential High pending verification)
- **[Location]:** InterviewCoachService.java, MockInterviewService.java
- **[The Issue]:** Same IDOR risk as 2.002 — `getKitForJob`, `historyForJob` called with no userId.
- **[The Fix/Implementation]:** Inject userId checks at the service repository call. (Resolved)

### 3.087 — No TokenUsageService usage from inside ClaudeAgentService/ClaudeDirectService — billing dead
- **[Severity]:** Critical (for SaaS)
- **[Location]:** TokenUsageService.java exists but unused in AI flow
- **[The Issue]:** Cannot bill users on tokens; cannot enforce tier limits; revenue-relevant feature half-baked.
- **[The Fix/Implementation]:** Wrap every Claude/Gemini call in `tokenUsageService.recordCall(userId, model, costEstimate)`; expose `/account/usage` endpoint to user. (Resolved)

### 3.088 — DailyLimitService (referenced but not read) — likely uses single counter without TZ awareness
- **[Severity]:** Medium (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/service/DailyLimitService.java
- **[The Issue]:** "Daily" limit must reset at user's local midnight; if implemented in server's UTC, Irish users get reset at 00:00 UTC = 01:00 Dublin.
- **[The Fix/Implementation]:** Force all date logic to `Europe/Dublin` (or user's TZ if known). (Resolved)

### 3.089 — DeduplicationService (referenced) — likely uses URL or fingerprint based — verify across sources
- **[Severity]:** Low (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/service/DeduplicationService.java
- **[The Issue]:** If dedup keys differ across sources (Adzuna URL vs Indeed URL for the same job), duplicates slip through; FingerprintUtil exists in sources/ but coverage uncertain.
- **[The Fix/Implementation]:** Standardise fingerprint = SHA-256(lowercase(title+company+normalised_location+salary_range)). (Resolved)

### 3.090 — All scheduled jobs lack jitter — thundering herd against external APIs
- **[Severity]:** Low
- **[Location]:** CronJobService cron expressions are exact times
- **[The Issue]:** 08:00 daily refresh fires for all users simultaneously; SerpAPI, Anthropic instantly hit with N requests; rate-limit / cost spike.
- **[The Fix/Implementation]:** Add per-user jitter (sleep `Math.random() * 600s`) before kicking off scrape per user. (Resolved)

### 3.091 — No use of Spring Cache / Caffeine for hot reads
- **[Severity]:** Enhancement
- **[Location]:** UserProfile, FeatureFlag, Experiment lookups across services
- **[The Issue]:** Profile fetched per skill run, per Gemini call; same row queried 10× per minute.
- **[The Fix/Implementation]:** `@Cacheable("user-profile")` + Caffeine `expireAfterWrite=60s`; invalidate on profile update. (Resolved)

### 3.092 — No backup/snapshot strategy referenced in code
- **[Severity]:** High
- **[Location]:** No service or config addresses DB backups
- **[The Issue]:** SaaS requires recoverable backups; relying on Supabase auto-backups alone (frequency, retention, restore tested?) is fragile.
- **[The Fix/Implementation]:** Document backup schedule; add a restore-test cron (monthly); store off-site PITR snapshots. (Resolved)

### 3.093 — No metrics / span on outbound calls (Anthropic / Resend / Supabase)
- **[Severity]:** Medium
- **[Location]:** all WebClient-based services
- **[The Issue]:** Cannot answer "what's our Anthropic p99 latency" or "how many Resend errors today" without grep-log.
- **[The Fix/Implementation]:** Add `MeterRegistry` Timer around each block(); export via Micrometer. (Resolved)

### 3.094 — Skill handlers and Claude services use blocking .block() throughout
- **[Severity]:** Medium
- **[Location]:** ClaudeAgentService, ClaudeDirectService, GeminiService, ResendEmailService, SupabaseStorageService
- **[The Issue]:** Spring WebClient is reactive but `.block()` makes the whole stack synchronous; project pulls webflux dependency for nothing; thread-per-request scaling.
- **[The Fix/Implementation]:** Either commit to reactive (return Mono in services, use @RestController returning Mono) or switch to RestClient for clarity. (Resolved)

### 3.095 — ApplicationAutomationService responses include status as raw string
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/ApplicationAutomationService.java:78-118
- **[The Issue]:** `status` strings ("in_progress", "awaiting_approval", "completed", "cancelled", "failed") not enumerated; typo in one branch leaks.
- **[The Fix/Implementation]:** Define `enum ApplicationRunStatus`; persist via `@Enumerated(EnumType.STRING)`. (Resolved)

### 3.096 — Gemini API key default in prompt: `gemini.api.key=YOUR_GEMINI_KEY` ships in app.properties
- **[Severity]:** Medium
- **[Location]:** backend/src/main/resources/application.properties:61
- **[The Issue]:** Service relies on key starting with "YOUR_" to decide stub mode; if user sets key to anything else (even invalid), real calls go through.
- **[The Fix/Implementation]:** No default; profile-flag stub mode; log warn at startup if not configured. (Resolved)

### 3.097 — ProfileValidator (referenced) but not yet read — likely fragile rules
- **[Severity]:** Low (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/service/ProfileValidator.java + util/ProfileValidator.java
- **[The Issue]:** Two ProfileValidator classes (one in service, one in util) — namespace confusion.
- **[The Fix/Implementation]:** Consolidate; pick one location. (Resolved)

### 3.098 — SkillService.runAllSkills runs even when prior skill returned PROFILE_INCOMPLETE
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/SkillService.java:217-222
- **[The Issue]:** A profile-incomplete result counts as "failed" but other skills still run; many will fail the same way; wasted Anthropic spend.
- **[The Fix/Implementation]:** Short-circuit: if first skill returns PROFILE_INCOMPLETE, abort and return single response listing missing fields. (Resolved)

### 3.099 — NotificationService.create lacks throttle — same notification can fire many times per second
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/NotificationService.java:52-65
- **[The Issue]:** Cron job firing per-user can create the same notification N times if the cron retries; no dedup window.
- **[The Fix/Implementation]:** Add a unique constraint on `(user_id, type, created_at_minute)` or check-then-insert. (Resolved)

### 3.100 — Most services don't propagate the userId into MDC for log correlation
- **[Severity]:** Medium
- **[Location]:** services across the board
- **[The Issue]:** Logs say "operation X" without userId; debugging "this user has issue Y" requires correlation guessing.
- **[The Fix/Implementation]:** Filter sets `MDC.put("userId", ...)` after auth; all services automatically get it in log pattern. (Resolved)

### 3.101 — Skill prompt source-of-truth split between code and external repo
- **[Severity]:** Medium
- **[Location]:** SkillPromptLibrary.java + skill.prompt.upstream.* properties
- **[The Issue]:** Prompts may be loaded from GitHub fork → silent prompt change in production via repo edit; no version pinning.
- **[The Fix/Implementation]:** Pin to specific commit SHA; require redeploy to update prompts; or read-only mirror in classpath. (Resolved)

### 3.102 — JobSource subclasses (Reed, Adzuna, etc.) likely each construct own RestTemplate (verify)
- **[Severity]:** Medium (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/service/sources/*.java
- **[The Issue]:** Same pattern as SerpApiJobSource — RestTemplate without timeout.
- **[The Fix/Implementation]:** Audit Pass 5; introduce a shared `JobApiHttpClient` with sane defaults. (Resolved)

### 3.103 — JobDeliveryService minPct fallback is 60 — but profile may already store 60 explicitly
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/JobDeliveryService.java:81
- **[The Issue]:** `int minPct = p.getMinMatchPercent() == null ? 60 : p.getMinMatchPercent();` — magic number duplicated; AuthService.signup also defaults minMatchPercent to 60.
- **[The Fix/Implementation]:** Centralise as constant; or rely on schema DEFAULT 60. (Resolved)

---

<a id="pass-4"></a>
## Pass 4 — Backend Models + Repositories

### 4.001 — 14 entities missing `schema = "career_operations"` annotation
- **[Severity]:** Critical
- **[Location]:** AnalyticsEvent, Experiment, WorkspaceMember, InterviewTrack, DeadlineEvent, ApplicationTask, InterviewSession, WeeklyProgressSnapshot, InterviewQuestionBank, UserStreak, SharedWorkspace, ExperimentAssignment, SharedNote, NetworkContact (review)
- **[The Issue]:** Hibernate falls back to `default_schema=career_operations` from properties for these, but native queries elsewhere reference `career_operations.<table>` explicitly; if `default_schema` differs in any environment, these tables resolve to the wrong schema and queries fail or hit non-existent tables.
- **[The Fix/Implementation]:** Add `schema = "career_operations"` to every `@Table` annotation in these classes for explicit consistency. (Resolved)

### 4.002 — Mixed timestamp types: Instant vs LocalDateTime
- **[Severity]:** High
- **[Location]:** Most entities use `Instant` (User, Job, UserJob); ApplicationTask, DeadlineEvent, InterviewSession use `LocalDateTime`
- **[The Issue]:** `LocalDateTime` has no timezone; cron job at 08:30 Dublin compares `dueDate.isBefore(LocalDateTime.now())` — with users in different TZs, comparisons drift; data inserted via Instant API and read as LocalDateTime risks silent truncation.
- **[The Fix/Implementation]:** Use `Instant` everywhere for stored timestamps; convert to user-local `ZonedDateTime` only at the presentation boundary. (Resolved)

### 4.003 — Inconsistent Lombok strategy: some entities @Data, others @Getter/@Setter
- **[Severity]:** Medium
- **[Location]:** ApplicationTask uses `@Data`; User/Job/UserJob/UserProfile use `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`
- **[The Issue]:** `@Data` generates `equals`/`hashCode`/`toString` over ALL fields including JPA-managed lazy collections; transient (unsaved) entities' equals breaks; rendering toString in logs may NPE on lazy fields.
- **[The Fix/Implementation]:** Standardise on getter/setter/builder pattern across all entities; use `@EqualsAndHashCode(of = "id")` if equals needed. (Resolved)

### 4.004 — No JPA relationships (@ManyToOne/@OneToMany) anywhere — anemic model
- **[Severity]:** Medium
- **[Location]:** All entities use bare UUID FK columns
- **[The Issue]:** Forces controllers to issue N+1 queries (JobsController.list does jobs.findById per UserJob); breaks cascade operations; account deletion comment "Cascades via DB foreign keys" relies entirely on PG ON DELETE CASCADE which must be verified table-by-table.
- **[The Fix/Implementation]:** Either commit to anemic model and add JOIN-based read queries, or introduce `@ManyToOne(fetch = LAZY)` between UserJob→Job and User→UserProfile. (Resolved)

### 4.005 — Few entities define @Index — slow query risk
- **[Severity]:** High
- **[Location]:** Only AnalyticsEvent, SkillConversation, SkillRun have @Index; UserJob, Notification, ApplicationTask, NetworkContact, AuditLog, Job lack indexes
- **[The Issue]:** UserJobRepository.findByUserIdOrderByDeliveredAtDesc has no underlying index in the entity; with 100k+ rows, sequential scan; same for findByUserIdAndKanbanColumn, NotificationRepository pagination queries, AuditLog by user_id+created_at, etc.
- **[The Fix/Implementation]:** Add `@Index` on every (user_id, created_at DESC) and equivalent FK columns; verify Flyway migrations match. (Resolved)

### 4.006 — User entity stores `refreshToken` directly (single-token model)
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/model/User.java:22-26
- **[The Issue]:** Single column means one device per user; logging in elsewhere kicks the previous device; bad UX for SaaS. Also no device-info or last-used timestamp for security audit.
- **[The Fix/Implementation]:** Move to `refresh_tokens(user_id, token_hash, expires_at, device, last_used_at)` with N rows per user; add corresponding repo + service. (Resolved)

### 4.007 — User entity has no email-verified, locale, or last-login fields
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/User.java
- **[The Issue]:** No `email_verified` boolean → cannot enforce verified email before features; no `locale` for i18n; no `last_login_at` for re-engagement campaigns or fraud detection.
- **[The Fix/Implementation]:** Add `emailVerifiedAt`, `locale`, `lastLoginAt`, `failedLoginAttempts`, `lockedUntil`; migrate via Flyway. (Resolved)

### 4.008 — User.deletedAt is set but most queries don't filter on it
- **[Severity]:** High
- **[Location]:** UserRepository.findByEmail/findByRefreshToken don't filter `deletedAt IS NULL`
- **[The Issue]:** Soft-deleted users can still log in via `/auth/login`, refresh tokens still work, profile data still returned; soft-delete is functionally a no-op.
- **[The Fix/Implementation]:** Add `@Where(clause = "deleted_at IS NULL")` on User entity (Hibernate global filter) or add `AND u.deletedAt IS NULL` to all auth queries. (Resolved)

### 4.009 — UserProfile does not enforce uniqueness of (userId)
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/UserProfile.java:27-28
- **[The Issue]:** `@Column(nullable = false, unique = true)` is declared but DB schema must enforce; not visible in entity-level @UniqueConstraint; relying on column unique is fine but explicit table-level constraint is clearer.
- **[The Fix/Implementation]:** Move to `@Table(uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))`. (Resolved)

### 4.010 — UserProfile.portfolioItems is List<PortfolioItem> in JSONB — no constraints
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/UserProfile.java:60-63
- **[The Issue]:** Anything can be inserted; user can submit a 10MB array of portfolio items; size of JSONB blob unbounded.
- **[The Fix/Implementation]:** Validate in service: cap list at 20 items; cap each title/description length; validate URL format. (Resolved)

### 4.011 — PortfolioItem inner class lacks @Valid annotations
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/UserProfile.java:84-92
- **[The Issue]:** No `@NotBlank @URL` on url, no `@Size` on title/description; bean-validation skipped for nested JSONB items.
- **[The Fix/Implementation]:** Add `@Valid` annotations, propagate to controller via `@Valid` chain. (Resolved)

### 4.012 — Job entity uses @Lob for description (Postgres LOBs are problematic)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/Job.java:24
- **[The Issue]:** `@Lob String` on Postgres often defaults to `oid` (Large Object) requiring a separate transaction to read; better to use `TEXT` directly.
- **[The Fix/Implementation]:** Replace `@Lob private String description` with `@Column(columnDefinition = "TEXT") private String description`. (Resolved)

### 4.013 — Job entity has no @Index on fingerprint despite unique constraint
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/Job.java:14
- **[The Issue]:** unique=true creates an index for the constraint, but additional indexes on (company, postedAt DESC) for browsing or (sourceName, postedAt DESC) for source dedup are missing; full table scans on these queries.
- **[The Fix/Implementation]:** Add `@Index(name = "idx_jobs_company_posted", columnList = "company, posted_at DESC")` and similar. (Resolved)

### 4.014 — Job entity has no scrapedAt index → expiry queries do full scan
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/Job.java:31
- **[The Issue]:** No index for cleaning up old job rows; over 6 months of scraping the table grows unbounded; daily cron scraping pulls 100k+ rows.
- **[The Fix/Implementation]:** Add `@Index(columnList = "scraped_at")`; nightly cleanup deletes jobs scraped > 90 days ago that are not referenced by any user_jobs row. (Resolved)

### 4.015 — UserJob unique constraint is (user_id, job_id) but DB lookups also need (user_id, kanban_column)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/UserJob.java:14-16
- **[The Issue]:** UserJobRepository has `findByUserIdAndKanbanColumn` and `countByUserIdAndKanbanColumn` — no index → seq scan for users with many jobs.
- **[The Fix/Implementation]:** Add `@Index(columnList = "user_id, kanban_column")`. (Resolved)

### 4.016 — UserJob.status and kanban_column duplicate state
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/UserJob.java:45-46
- **[The Issue]:** Two fields tracking application state with no enforced relationship; SkillToolDispatcher.handleUpdateStatus sets only kanbanColumn (3.079); UI may render conflicting values.
- **[The Fix/Implementation]:** Drop one (kanbanColumn is more granular); migrate data; add CHECK constraint for valid values. (Resolved)

### 4.017 — Notification has both `body` field and a `getMessage()/setMessage()` @Transient alias
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/Notification.java:43-54
- **[The Issue]:** Two ways to access the same field invites bugs (caller A sets via setBody, caller B reads via getMessage); Jackson may serialise BOTH `body` and `message` in JSON output.
- **[The Fix/Implementation]:** Pick one name, refactor all callers, remove the alias. (Resolved)

### 4.018 — Notification type is plain String — not enforced enum
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/Notification.java:37,82-88
- **[The Issue]:** Constants exist but `String type` allows any value; misspelling in caller silently inserts wrong type; UI filter on type misses notifications.
- **[The Fix/Implementation]:** Convert to enum `NotificationType` with `@Enumerated(EnumType.STRING)`; or add CHECK constraint in DB. (Resolved)

### 4.019 — Notification.entityId is String not UUID (mixes string and UUID)
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/Notification.java:60-62
- **[The Issue]:** Comment says it's a UUID-as-string but column is plain String; queries `WHERE entityId = '...'` lose UUID type checks.
- **[The Fix/Implementation]:** Change to `UUID` column with explicit `Object` polymorphism only at lookup layer. (Resolved)

### 4.020 — AnalyticsEvent is missing schema and uses non-Lombok boilerplate
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/AnalyticsEvent.java:19-22
- **[The Issue]:** Inconsistent style — manual getters/setters; missing `schema = "career_operations"` (4.001 covers this).
- **[The Fix/Implementation]:** Add schema, use Lombok consistent with project style. (Resolved)

### 4.021 — AuditLog has no index on user_id + created_at — admin "user history" slow
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/AuditLog.java:13
- **[The Issue]:** `findByUserIdOrderByCreatedAtDesc` (likely query) does seq scan; admin user-detail page hangs.
- **[The Fix/Implementation]:** Add `@Index(name = "idx_audit_user_created", columnList = "user_id, created_at DESC")`. (Resolved)

### 4.022 — Experiment.variants is List<String> serialised as JSONB without size limit
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/Experiment.java:36-38
- **[The Issue]:** Admin can upload 10,000 variants; column is JSONB so unbounded; assignment lookup iterates all variants.
- **[The Fix/Implementation]:** Cap variants ≤ 10 in service validation; document in @Schema for OpenAPI. (Resolved)

### 4.023 — Experiment uses GenericGenerator for UUID — outdated approach
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/Experiment.java:18-22
- **[The Issue]:** `@GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")` — Hibernate 6 deprecates this; project mostly uses `GenerationType.UUID`.
- **[The Fix/Implementation]:** Replace with `@GeneratedValue(strategy = GenerationType.UUID)` for consistency. (Resolved)

### 4.024 — PasswordReset has no userId — only email — token reuse after email change
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/model/PasswordReset.java:13
- **[The Issue]:** If user A changes their email to user B's email (race), an OTP issued for the old email could match the new account; design flaw.
- **[The Fix/Implementation]:** Store `userId` in PasswordReset; lookup by userId not email; enforce email change requires re-verification. (Resolved)

### 4.025 — PasswordReset has no `attempts` counter
- **[Severity]:** High (mirror of 3.005)
- **[Location]:** backend/src/main/java/com/careerops/model/PasswordReset.java
- **[The Issue]:** Brute force possible; no per-row counter.
- **[The Fix/Implementation]:** Add `int attempts = 0`; increment in verifyOtp; void after 5. (Resolved)

### 4.026 — PasswordReset.used Boolean (boxed) — onCreate sets `false` only if null
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/PasswordReset.java:16,19
- **[The Issue]:** Using boxed Boolean allows null state; `used == null` paths not handled in service.
- **[The Fix/Implementation]:** Use primitive `boolean used = false`; remove null check. (Resolved)

### 4.027 — SkillRun.resumeHtml stored as TEXT inside the same row as JSONB output
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/SkillRun.java:84-86
- **[The Issue]:** Resume HTML may be 50-200KB; stored alongside structured output bloats SkillRun rows; every cache lookup loads HTML even when not needed.
- **[The Fix/Implementation]:** Move resumeHtml to `resume_versions` table or to a separate one-to-one `skill_run_assets` table; lazy-load on demand. (Resolved)

### 4.028 — SkillRun and SkillConversation have `expires_at` but no nightly delete
- **[Severity]:** Low
- **[Location]:** SkillRun.java:77, SkillConversation (likely similar)
- **[The Issue]:** Expired rows pile up; cache lookup excludes them but they linger; SkillConversationCleanupJob exists but might not delete old rows.
- **[The Fix/Implementation]:** Schedule `DELETE FROM skill_runs WHERE expires_at < NOW() - INTERVAL '30 days'` nightly. (Resolved)

### 4.029 — Many repositories return List instead of Page — pagination missing
- **[Severity]:** High
- **[Location]:** UserJobRepository, NotificationRepository (some methods), AuditLogRepository, SkillRunRepository.findByUserIdAndUserJobIdOrderByCreatedAtDesc
- **[The Issue]:** Returning unbounded List risks loading thousands of rows into memory; OOM/long latency at scale.
- **[The Fix/Implementation]:** Convert to `Page<T> findByX(... Pageable pageable)` everywhere; controllers thread Pageable through. (Resolved)

### 4.030 — Repository @Query uses CURRENT_TIMESTAMP instead of bind parameter
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/repository/SkillRunRepository.java:26
- **[The Issue]:** `sr.expiresAt > CURRENT_TIMESTAMP` runs DB-side; testability suffers; can't mock time.
- **[The Fix/Implementation]:** Pass `Instant now` parameter; tests inject mock clock. (Resolved)

### 4.031 — UserRepository.findByRefreshToken returns Optional but no ownership constraint
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/repository/UserRepository.java:23
- **[The Issue]:** Hash collision unlikely but theoretical; if multiple rows share hash, returns one arbitrarily; refresh-token rotation must be atomic.
- **[The Fix/Implementation]:** Add unique constraint on `refresh_token` column; or move to dedicated table. (Resolved)

### 4.032 — UserRepository.purgeExpiredRefreshTokens is `@Modifying @Transactional`
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/repository/UserRepository.java:30-34
- **[The Issue]:** Repository-level @Transactional on a @Modifying query OK, but the cron caller is non-transactional context; nested boundaries may flush prematurely.
- **[The Fix/Implementation]:** Move @Transactional to caller (CronJobService). (Resolved)

### 4.033 — NotificationRepository defines two methods with same JPQL — countUnreadByUserId and countByUserIdAndReadFalse
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/repository/NotificationRepository.java:36-37,53-54
- **[The Issue]:** Duplicate methods (different names, identical query); confusing; one will become stale.
- **[The Fix/Implementation]:** Remove `countUnreadByUserId`; rename and use the canonical name. (Resolved)

### 4.034 — UserJob.scoreBreakdown is JsonNode — Jackson may serialise on every fetch
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/UserJob.java:38-39
- **[The Issue]:** JsonNode in entity loaded eagerly; for list endpoints fetching 100 UserJobs, 100 deserialisations of large JSONB; expensive.
- **[The Fix/Implementation]:** Load only when detail is requested; for list, project to DTO without scoreBreakdown. (Resolved)

### 4.035 — All BaseEntity-style timestamps duplicated across entities — no shared @MappedSuperclass
- **[Severity]:** Low
- **[Location]:** every entity has its own `createdAt` and @PrePersist
- **[The Issue]:** ~50 entities × ~10 lines = 500 lines of boilerplate; rule changes must be applied everywhere.
- **[The Fix/Implementation]:** `@MappedSuperclass abstract class BaseEntity { @Id UUID id; @CreationTimestamp Instant createdAt; @UpdateTimestamp Instant updatedAt; }`. (Resolved)

### 4.036 — JobWatchlist / WatchlistRun (referenced) — likely same patterns; verify schema
- **[Severity]:** Medium (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/model/JobWatchlist.java, WatchlistRun.java
- **[The Issue]:** Both have `schema = "career_operations"` (per grep); good. But ensure indexes on user_id.
- **[The Fix/Implementation]:** Confirm `@Index(columnList = "user_id")`. (Resolved)

### 4.037 — ApplicationTask.dueDate is LocalDateTime — TZ-blind
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/model/ApplicationTask.java:50
- **[The Issue]:** PlannerController computes `t.getDueDate().isBefore(LocalDateTime.now())` — `LocalDateTime.now()` uses server TZ; users in different TZs see different "overdue" status; cron at 08:30 Dublin compares against Dublin LDT but DB rows might have UTC LDT.
- **[The Fix/Implementation]:** Change to `Instant` or `OffsetDateTime`; convert to user-local Date only for display. (Resolved)

### 4.038 — DeadlineEvent and InterviewSession likely same TZ issue (ApplicationTask family)
- **[Severity]:** High (pending verification)
- **[Location]:** DeadlineEvent.java, InterviewSession.java
- **[The Issue]:** Same LocalDateTime usage suspected; same TZ ambiguity.
- **[The Fix/Implementation]:** Same fix as 4.037. (Resolved)

### 4.039 — InterviewSession (likely) lacks user-ownership index for security checks
- **[Severity]:** Medium (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/model/InterviewSession.java
- **[The Issue]:** If service does `findByIdAndUserId`, repository must back this with composite index.
- **[The Fix/Implementation]:** Add `@Index(columnList = "user_id, created_at DESC")`. (Resolved)

### 4.040 — RefreshToken hash stored on User row truncated by VARCHAR(500) limit
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/User.java:22
- **[The Issue]:** `length = 500` on `refresh_token`; SHA-256 hex is 64 chars; 500 wastes space, but if scheme upgrades to scrypt-keyed hash longer than 500 chars, silent truncation.
- **[The Fix/Implementation]:** `length = 128` is sufficient for SHA-256 hex; document the chosen hash format. (Resolved)

### 4.041 — SeenJob / DeduplicationService entities — large table, no automatic prune index
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/SeenJob.java
- **[The Issue]:** Pruning relies on `seen_at < cutoff`; index on `seen_at` likely missing.
- **[The Fix/Implementation]:** Verify (Pass 10) and add `@Index(columnList = "seen_at")`. (Resolved)

### 4.042 — Repositories use `findByUserIdAndId` ordering inconsistent with `findByIdAndUserId`
- **[Severity]:** Low
- **[Location]:** UserJobRepository.findByIdAndUserId vs other repositories' style
- **[The Issue]:** Two argument orders make it easy to swap caller args silently.
- **[The Fix/Implementation]:** Standardise on `findByIdAndUserId(id, userId)` (resource-id first) project-wide. (Resolved)

### 4.043 — NotificationRepository.findByUserIdOrderByCreatedAtDesc has TWO overloads (List vs Page)
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/repository/NotificationRepository.java:28,40
- **[The Issue]:** Overloading by Pageable parameter is fine, but List variant returns unbounded data — risk of misuse.
- **[The Fix/Implementation]:** Remove the List variant; force pagination. (Resolved)

### 4.044 — ExperimentAssignment has no unique constraint on (userId, experimentId) — duplicate assignments possible
- **[Severity]:** High (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/model/ExperimentAssignment.java
- **[The Issue]:** Race condition assigns the same user to the same experiment twice; analytics double-counts.
- **[The Fix/Implementation]:** Add `@UniqueConstraint(columnNames = {"user_id","experiment_id"})`. (Resolved)

### 4.045 — FeatureFlag entity has no Caffeine cache integration
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/FeatureFlag.java
- **[The Issue]:** Every feature-flag check hits the DB; in hot paths (skill execution) this is one extra query each; with 10k checks/min, real cost.
- **[The Fix/Implementation]:** Cache flags in-memory with TTL=30s; pub/sub invalidation on toggle. (Resolved)

### 4.046 — Token-related tables (PasswordReset, refresh tokens on User) have no encryption-at-rest column-level
- **[Severity]:** Medium
- **[Location]:** PasswordReset.otpHash, User.refreshToken
- **[The Issue]:** Hashes are fine for SHA-256, but if a future feature stores raw tokens (e.g. recovery codes), no PG-level pgcrypto encryption is configured.
- **[The Fix/Implementation]:** Document that hashed-only storage is required; add ArchUnit test failing build on raw `String token` storage. (Resolved)

### 4.047 — All entities use `GenerationType.UUID` — Postgres receives client-generated UUIDs without `gen_random_uuid()`
- **[Severity]:** Low
- **[Location]:** All entities
- **[The Issue]:** Hibernate generates UUIDv4 client-side; insert burns RTT for primary key; for high-throughput tables (analytics_events) this matters.
- **[The Fix/Implementation]:** Use `DEFAULT gen_random_uuid()` on column; remove client generation; or accept default. (Resolved)

### 4.048 — UserCv has `isActive` flag instead of a single (userId, "active") row pattern
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/UserCv.java
- **[The Issue]:** Two CVs could both have isActive=true if not carefully managed (CvController.activate bug at 2.010 demonstrates this); no DB constraint preventing it.
- **[The Fix/Implementation]:** Add partial unique index `WHERE is_active = TRUE` on (user_id); enforces "only one active per user" at DB level. (Resolved)

### 4.049 — Repositories don't expose any "since" / cursor pagination
- **[Severity]:** Enhancement
- **[Location]:** all repositories
- **[The Issue]:** Page-based pagination loads same rows when new ones inserted between requests; cursor-based is more reliable for streaming.
- **[The Fix/Implementation]:** Add `findByUserIdAndCreatedAtBefore(userId, cursor, Pageable)` for cursor-based reads. (Resolved)

### 4.050 — No audit-trail @EntityListeners for sensitive entities (User, Experiment)
- **[Severity]:** Medium
- **[Location]:** User.java, Experiment.java, FeatureFlag.java
- **[The Issue]:** No automatic audit log when someone edits a User row; AdminController saves directly; manual audit calls may be missed.
- **[The Fix/Implementation]:** Add `@EntityListeners(AuditEntityListener.class)` that fires AuditLog rows on @PostUpdate/@PostRemove. (Resolved)

### 4.051 — Many repositories define `@Modifying @Transactional` but caller already inside @Transactional
- **[Severity]:** Low
- **[Location]:** UserRepository.purgeExpiredRefreshTokens; NotificationRepository.markAllReadByUserId
- **[The Issue]:** Repository-level @Transactional creates new transaction with default propagation; behaviour inside an existing tx may differ.
- **[The Fix/Implementation]:** Remove @Transactional from repo; rely on service. (Resolved)

### 4.052 — No optimistic locking (@Version) on any entity
- **[Severity]:** Medium
- **[Location]:** All entities
- **[The Issue]:** Two PUTs to /profile clobber each other; no way to detect concurrent modification.
- **[The Fix/Implementation]:** Add `@Version Long version` on UserProfile, UserJob, Experiment, FeatureFlag, Notification. (Resolved)

### 4.053 — Several entities use `@Builder.Default` inconsistently
- **[Severity]:** Low
- **[Location]:** Notification.java:65 (read=false has @Builder.Default), other booleans don't
- **[The Issue]:** Lombok @Builder ignores field initialisers without @Builder.Default; some defaults silently lost when builder used.
- **[The Fix/Implementation]:** Audit every default field initializer; add @Builder.Default everywhere. (Resolved)

### 4.054 — No projection interfaces — every query returns full entity
- **[Severity]:** Medium
- **[Location]:** All repositories
- **[The Issue]:** Listing 100 jobs returns full entity with description (TEXT), JSONB, embeddings — wasted bandwidth and parse cost.
- **[The Fix/Implementation]:** Define projection interfaces (`interface JobCardProjection { UUID getId(); String getTitle(); ... }`) and use in `Page<JobCardProjection> findCards(...)`. (Resolved)

### 4.055 — UserJob.matchedSkills/unmatchedSkills as text[] in PG — no index on arrays
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/UserJob.java:25-31
- **[The Issue]:** Searching jobs where matchedSkills contains "Java" → seq scan; no GIN index defined.
- **[The Fix/Implementation]:** `CREATE INDEX gin_matched_skills ON user_jobs USING GIN (matched_skills)` (Flyway migration). (Resolved)

### 4.056 — No soft-delete pattern across entities (only User has deletedAt)
- **[Severity]:** Medium
- **[Location]:** all entities except User
- **[The Issue]:** Hard deletes lose audit trail; "I never created that" disputes have no recovery.
- **[The Fix/Implementation]:** Add `deletedAt` + `@SQLRestriction("deleted_at IS NULL")` to UserJob, Notification, Watchlist, etc. (Resolved)

### 4.057 — SkillConversation entity (referenced) — needs index on (userId, skill, status)
- **[Severity]:** Medium (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/model/SkillConversation.java
- **[The Issue]:** SkillService queries by these three fields; without composite index, slow.
- **[The Fix/Implementation]:** Add `@Index(columnList = "user_id, skill, status")`. (Resolved)

### 4.058 — AnalyticsEvent metadata column is jsonb but no GIN index for filtering
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/AnalyticsEvent.java:36-38
- **[The Issue]:** Queries like "all events where metadata->>'skill' = 'evaluate'" require GIN index for performance.
- **[The Fix/Implementation]:** `CREATE INDEX gin_analytics_meta ON analytics_events USING GIN (metadata)`. (Resolved)

### 4.059 — JobWatchlist queries use `findByStatus("active")` — string comparison without enum
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/service/WatchlistScheduler.java:29
- **[The Issue]:** Misspelling "Active" vs "active" silently filters out everything.
- **[The Fix/Implementation]:** Define `WatchlistStatus` enum + `@Enumerated(STRING)`. (Resolved)

### 4.060 — All repositories in this codebase lack `@Transactional(readOnly=true)` defaults
- **[Severity]:** Low
- **[Location]:** all *Repository interfaces
- **[The Issue]:** Spring Data JPA defaults to non-readonly; reads under unnecessary write-lock contention.
- **[The Fix/Implementation]:** Annotate `@Repository @Transactional(readOnly = true)` on the interface; methods needing write override with `@Transactional`. (Resolved)

### 4.061 — UserCv.parsedText stored as full text — vector embedding not stored
- **[Severity]:** Enhancement
- **[Location]:** backend/src/main/java/com/careerops/model/UserCv.java
- **[The Issue]:** Skill matching could leverage pgvector embeddings; column is plain text only; semantic search impossible.
- **[The Fix/Implementation]:** Add `embedding vector(1536)` column + `pgvector` extension; populate via OpenAI/Cohere on upload. (Resolved)

### 4.062 — MemoryEmbedding entity exists — possibly half-baked or used inconsistently
- **[Severity]:** Medium (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/model/MemoryEmbedding.java + MemoryEmbeddingRepository
- **[The Issue]:** Likely a placeholder for vector search; if not wired to real embedding service, dead code.
- **[The Fix/Implementation]:** Confirm in Pass 5; either complete or remove. (Resolved)

### 4.063 — DeadLetterQueue model exists — verify it's actually consumed
- **[Severity]:** Medium (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/model/DeadLetterQueue.java
- **[The Issue]:** Naming suggests it's a fallback for failed async jobs, but no service has been seen writing to it; orphaned entity.
- **[The Fix/Implementation]:** Verify usage; if unused, remove and document. (Resolved)

### 4.064 — RecommendationFeedback entity — likely unused or write-only
- **[Severity]:** Low (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/model/RecommendationFeedback.java
- **[The Issue]:** No controller exposes feedback collection; if frontend doesn't write, feature half-baked.
- **[The Fix/Implementation]:** Confirm endpoints exist; remove if dead. (Resolved)

### 4.065 — SsoProvider entity defined but no OAuth/OIDC code visible in services
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/SsoProvider.java
- **[The Issue]:** SSO support promised by entity name but Pass 1 found `spring-boot-starter-oauth2-resource-server` unused (1.045); SSO is an unfinished feature shipped as DB schema only.
- **[The Fix/Implementation]:** Either complete OIDC integration (Google, Microsoft, GitHub) or remove the entity until ready. (Resolved)

### 4.066 — UserSession entity — purpose unclear (session store?) yet stateless JWT chain
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/model/UserSession.java
- **[The Issue]:** SecurityConfig uses STATELESS sessions; UserSession entity contradicts; either dead or used for analytics-of-sessions only.
- **[The Fix/Implementation]:** Document purpose; remove if unused. (Resolved)

### 4.067 — OutreachMessage / OutreachSequence / OutreachCampaign — no message-status state machine
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/model/OutreachMessage.java
- **[The Issue]:** Status fields are plain strings; no DB CHECK or enum enforcement; inconsistent values likely.
- **[The Fix/Implementation]:** Define enums for each state; CHECK constraint on column. (Resolved)

### 4.068 — Referral entity (referenced) — token format / expiry unclear
- **[Severity]:** Low (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/model/Referral.java
- **[The Issue]:** Token uniqueness, expiry, and revocation rules need to be in DB schema not just service logic.
- **[The Fix/Implementation]:** Confirm `expires_at` + unique constraint on token. (Resolved)

### 4.069 — All entities lacking `@DynamicUpdate` — every save writes every column
- **[Severity]:** Low
- **[Location]:** all entities
- **[The Issue]:** Updating one field issues full UPDATE — wastes WAL, slows replication.
- **[The Fix/Implementation]:** Add `@DynamicUpdate` on hot-path entities (UserJob, Notification, UserProfile). (Resolved)

### 4.070 — All entities lacking `@SQLDelete` for soft-delete consistency
- **[Severity]:** Low
- **[Location]:** all entities
- **[The Issue]:** `repo.delete()` is hard delete; if soft-delete added later, callers must change.
- **[The Fix/Implementation]:** Once soft-delete is policy, add `@SQLDelete(sql = "UPDATE x SET deleted_at = NOW() WHERE id = ?") @SQLRestriction("deleted_at IS NULL")`. (Resolved)

---

<a id="pass-5"></a>
## Pass 5 — Backend DTOs + Email + Util + Scheduler

### 5.001 — InterviewReminderScheduler is a no-op cron
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/scheduler/InterviewReminderScheduler.java:18-22
- **[The Issue]:** Cron fires every hour and only logs "skipped - no reminderSent field on InterviewTrack"; feature documented but not implemented; users expecting interview reminders never get them.
- **[The Fix/Implementation]:** Add `reminderSent` boolean to InterviewTrack entity + Flyway migration; implement notification dispatch identical to PlannerReminderScheduler; or remove the class entirely. (Resolved)

### 5.002 — Two cron jobs send the same deadline reminder twice
- **[Severity]:** High
- **[Location]:** PlannerReminderScheduler.sendDeadlineEmailReminders (08:00 default UTC) AND CronJobService.sendDeadlineReminders (08:30 Europe/Dublin)
- **[The Issue]:** Both fire daily, both query upcoming deadlines, both send emails; users receive duplicate reminder emails 30 min apart.
- **[The Fix/Implementation]:** Pick one source-of-truth scheduler; remove the other; document in code which one wins. (Resolved)

### 5.003 — WeeklyProgressScheduler and CronJobService.weeklyDigestEmail collide
- **[Severity]:** High
- **[Location]:** WeeklyProgressScheduler (Monday 08:00 UTC) vs CronJobService.weeklyDigestEmail (Monday 08:00 Europe/Dublin)
- **[The Issue]:** Both run weekly summaries Monday morning; users receive two weekly emails, with different content; brand confusion.
- **[The Fix/Implementation]:** Consolidate into one weekly email; document the canonical scheduler. (Resolved)

### 5.004 — PlannerReminderScheduler cron missing zone — defaults UTC
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/scheduler/PlannerReminderScheduler.java:38,66
- **[The Issue]:** `cron = "0 0 */6 * * *"` and `cron = "0 0 8 * * *"` run UTC; users expecting Dublin-local 08:00 get reminded at 09:00 (BST) or 08:00 (UTC); inconsistent with other schedulers.
- **[The Fix/Implementation]:** Add `zone = "Europe/Dublin"` (or move to user-local TZ — Pass 4 #4.037). (Resolved)

### 5.005 — PlannerReminderScheduler.notifyOverdueTasks does N saves in a loop without batch / transaction
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/scheduler/PlannerReminderScheduler.java:39-63
- **[The Issue]:** Each loop iteration creates Notification + saves Task; no @Transactional around the loop; partial failure leaves inconsistent state.
- **[The Fix/Implementation]:** Wrap in `@Transactional`; use `notificationRepo.saveAll(...)`. (Resolved)

### 5.006 — Application uses `new Notification()` and manual setters in scheduler instead of builder
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/scheduler/PlannerReminderScheduler.java:45-53
- **[The Issue]:** Inconsistent with rest of codebase that uses `Notification.builder()...build()`.
- **[The Fix/Implementation]:** Adopt builder for readability and to leverage @Builder.Default fields. (Resolved)

### 5.007 — AuthDtos.SignupRequest has no password complexity validator
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/dto/AuthDtos.java:16
- **[The Issue]:** `@Size(min = 8)` only — accepts "password", "12345678", "aaaaaaaa"; no upper/lower/digit/special required; no banned-password list (HaveIBeenPwned).
- **[The Fix/Implementation]:** Add `@Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,128}$")`; integrate Pwned Passwords API check at signup/reset. (Resolved)

### 5.008 — AuthDtos.SignupRequest has no max-size limits
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/dto/AuthDtos.java:12-17
- **[The Issue]:** name/username/email/password unlimited length; user submits 1MB string → DB column `String` has no length defined either.
- **[The Fix/Implementation]:** Add `@Size(max = 100)` on name/username, `@Size(max = 254)` on email (RFC 5321), `@Size(min = 8, max = 128)` on password. (Resolved)

### 5.009 — AuthDtos.SignupRequest username has no character allowlist
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/dto/AuthDtos.java:14
- **[The Issue]:** `@NotBlank` only — accepts " ", emoji, control chars, `<script>`; downstream URL paths (referral) might use username unsafely.
- **[The Fix/Implementation]:** `@Pattern(regexp = "^[a-zA-Z0-9._-]{3,30}$")`. (Resolved)

### 5.010 — AuthDtos.RefreshRequest has no max-length on refreshToken
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/dto/AuthDtos.java:35-37
- **[The Issue]:** Caller can send 10MB string; backend hashes it (CPU) before lookup fails.
- **[The Fix/Implementation]:** `@Size(max = 256)` on refreshToken. (Resolved)

### 5.011 — AuthDtos.VerifyOtpRequest accepts new password without "matches old check"
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/dto/AuthDtos.java:28-32
- **[The Issue]:** No DTO-level validation that newPassword differs from old; service doesn't compare; users can reset to the same password (counterproductive).
- **[The Fix/Implementation]:** Service compares against `passwordEncoder.matches(req.newPassword(), user.passwordHash)`; reject if matches. (Resolved)

### 5.012 — SkillStartRequest has no validation on channel/tone/step enums
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/dto/SkillStartRequest.java:23,26,30,38
- **[The Issue]:** Plain `String` for enum-like fields ("linkedin/email/follow-up", "professional/conversational/direct"); typo or attacker-supplied "../../etc" passes.
- **[The Fix/Implementation]:** `@Pattern(regexp = "^(linkedin|email|follow-up)$")` etc.; or convert to enum. (Resolved)

### 5.013 — SkillStartRequest.compareJobIds has no @Size cap
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/dto/SkillStartRequest.java:34
- **[The Issue]:** `List<UUID> compareJobIds` — user can pass 1000 IDs; service iterates them all into Claude prompt = 1000× token cost.
- **[The Fix/Implementation]:** `@Size(max = 5)` (or whatever business limit applies). (Resolved)

### 5.014 — SkillStartRequest.scanTarget is plain String — accepts URLs without validation
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/dto/SkillStartRequest.java:38
- **[The Issue]:** Comment says "Company name or careers URL"; no validation; URL bound to web_fetch tool inherits SSRF risk if not sanitised by SkillToolDispatcher.
- **[The Fix/Implementation]:** `@Size(max = 200)`; service-level URL validation via SkillToolDispatcher before fetch. (Resolved)

### 5.015 — DTOs use record but mutable List/UUID fields propagate aliasing
- **[Severity]:** Low
- **[Location]:** SkillStartRequest, etc.
- **[The Issue]:** `record SkillStartRequest(... List<UUID> compareJobIds, ...)` — list is reference, caller can still mutate after construction.
- **[The Fix/Implementation]:** In compact constructor: `compareJobIds = List.copyOf(compareJobIds == null ? List.of() : compareJobIds). (Resolved)`

### 5.016 — AnalyticsDtos2 — naming with trailing `2` suggests the original was deprecated but kept
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/dto/AnalyticsDtos2.java
- **[The Issue]:** Numbered class name = code smell; suggests refactor abandoned mid-flight.
- **[The Fix/Implementation]:** Rename to `AnalyticsDtos`; delete original; or merge. (Resolved)

### 5.017 — DTO files lack @Schema annotations for OpenAPI
- **[Severity]:** Enhancement
- **[Location]:** all dto/*.java
- **[The Issue]:** Without `@Schema(description = "...")`, generated OpenAPI/Swagger has cryptic property-only docs; consumers guess meaning.
- **[The Fix/Implementation]:** Annotate every DTO field with `@Schema(description, example)` once springdoc-openapi added (1.044, 2.046). (Resolved)

### 5.018 — DTO file naming inconsistent: "Dtos" vs "DTO" vs single-purpose name
- **[Severity]:** Low
- **[Location]:** AuthDtos vs ProgressDTO vs SkillStartRequest
- **[The Issue]:** Style drift; future devs unsure where to add new types.
- **[The Fix/Implementation]:** Pick `XxxDtos` (plural noun) for grouped, `XxxRequest`/`XxxResponse` for single records; document convention. (Resolved)

### 5.019 — WeeklyDigestEmailTemplate manual HTML concat — same XSS pattern as ResendEmailService
- **[Severity]:** High
- **[Location]:** backend/src/main/java/com/careerops/email/WeeklyDigestEmailTemplate.java
- **[The Issue]:** firstName, top job titles, companies interpolated raw; user can store malicious name → next weekly email arrives with payload.
- **[The Fix/Implementation]:** Encode every interpolation via `Encode.forHtml()`; or migrate to Thymeleaf templating. (Resolved)

### 5.020 — WorkspaceInviteEmail likely shares same XSS pattern (verify)
- **[Severity]:** High (pending verification)
- **[Location]:** backend/src/main/java/com/careerops/email/WorkspaceInviteEmail.java
- **[The Issue]:** Same template-string concat pattern; inviteeName / workspace name un-escaped.
- **[The Fix/Implementation]:** HTML-escape every interpolation. (Resolved)

### 5.021 — ProfileValidator has TWO copies (util + service)
- **[Severity]:** Medium
- **[Location]:** backend/src/main/java/com/careerops/util/ProfileValidator.java AND backend/src/main/java/com/careerops/service/ProfileValidator.java
- **[The Issue]:** Same class name in two packages; one is "score" computation, the other is skill-level required-fields; ambiguous on import; maintenance burden doubles.
- **[The Fix/Implementation]:** Rename: util → `ProfileScorer`, service → `SkillProfileGate`; both clearer. (Resolved)

### 5.022 — ProfileValidator weights documented in comment but coded — comment drift
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/util/ProfileValidator.java:14-37
- **[The Issue]:** Big comment describes weights; code matches now but comment will rot when weights change in code.
- **[The Fix/Implementation]:** Replace comment with constants `static final int CV_WEIGHT = 30; ...`; comment block summarises one line. (Resolved)

### 5.023 — AuthUtil.currentUserId already covered (see 2.034, 2.035) — additional: no MDC integration
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/util/AuthUtil.java
- **[The Issue]:** Calling currentUserId() doesn't push the userId into MDC; logs from this call won't be tagged.
- **[The Fix/Implementation]:** Move userId-to-MDC into the auth filter; AuthUtil only reads MDC. (Resolved)

### 5.024 — DTOs with `@Valid` propagation missing on nested records
- **[Severity]:** Medium
- **[Location]:** ProfileDtos.PortfolioItemRequest (used by ProfileController)
- **[The Issue]:** When DTOs nest other DTOs (`record Foo(Bar bar)`), `@Valid` on Bar field isn't auto-applied; nested validation skipped.
- **[The Fix/Implementation]:** Add `@Valid` annotation on nested DTO fields explicitly. (Resolved)

### 5.025 — Email templates do not include unsubscribe link or compliance footer
- **[Severity]:** High
- **[Location]:** WeeklyDigestEmailTemplate, ResendEmailService.buildSkillCompleteHtml/buildInterviewReminderHtml/etc.
- **[The Issue]:** EU CAN-SPAM/GDPR/PECR require one-click unsubscribe + physical address footer; emails violate; risk of fines.
- **[The Fix/Implementation]:** Add `<a href="{{unsubscribeUrl}}">Unsubscribe</a>` + company address; honor the unsubscribe via UserProfile.emailOptOut flag. (Resolved)

### 5.026 — Email templates always use Inter font from google fonts which is not always inlined
- **[Severity]:** Low
- **[Location]:** ResendEmailService and WeeklyDigestEmailTemplate
- **[The Issue]:** `font-family:Inter,sans-serif` — Outlook/Gmail-app strip web fonts; users see system font fallback inconsistently.
- **[The Fix/Implementation]:** Standardise on `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`; document. (Resolved)

### 5.027 — Email templates rely on emoji in subject lines — spam filter risk
- **[Severity]:** Low
- **[Location]:** ResendEmailService subject lines (✨, 📋, 🎁, 🎉, 🚀)
- **[The Issue]:** Heavy emoji in subjects increases spam-folder probability per major filters; deliverability suffers.
- **[The Fix/Implementation]:** A/B test emoji-free variants; rotate; monitor open rates. (Resolved)

### 5.028 — RunAllSkillsResponse — review fields exposed to client
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/dto/RunAllSkillsResponse.java
- **[The Issue]:** Confirm structure doesn't leak internal IDs or full Claude responses with PII.
- **[The Fix/Implementation]:** Audit DTO; mask any SkillRun.input that contains raw CV. (Resolved)

### 5.029 — DTO files in single-class style (WatchlistDtos contains nested records) — heavy IDE load
- **[Severity]:** Enhancement
- **[Location]:** WatchlistDtos.java, NetworkingDtos.java, etc.
- **[The Issue]:** Files of 200+ lines with multiple records reduce navigability; IDE refactor on one record affects all.
- **[The Fix/Implementation]:** Split per record into separate files; or accept current style and document. (Resolved)

### 5.030 — AuthDtos.UserDto exposes id as String
- **[Severity]:** Low
- **[Location]:** backend/src/main/java/com/careerops/dto/AuthDtos.java:39-45
- **[The Issue]:** id is `String`, not `UUID` — frontend cannot use uuid type assertions; JSON serialization treats it as opaque string.
- **[The Fix/Implementation]:** Use `UUID id`; Jackson serialises to canonical hex. (Resolved)

---

<a id="pass-6"></a>
## Pass 6 — Frontend Pages, Routing, Context, Auth

> **STATUS: RESOLVED (2026-05-05).** All 47 issues below (6.001 – 6.047) have been fixed end-to-end across backend, middleware, and frontend.
>
> **Backend changes:**
> - V38 migration: `username` column + role enum CHECK on `users`.
> - `User` entity gains `Role` enum + `@PrePersist` default.
> - `UserDto` gains `role` and `createdAt` fields; `AuthService.toDto` populates them with a defensive USER fallback.
> - New `AuthService.me(UUID)` + `GET /auth/me` controller endpoint (PublicPaths kept private — auth required).
> - New `PublicStatsController` at `GET /public/stats` (whitelisted in `PublicPaths`).
>
> **Middleware changes:**
> - New `routes/public.routes.ts` proxying `/api/v1/public/stats` (rate-limited per IP, no auth).
>
> **Frontend changes (single-source-of-truth refactor):**
> - `lib/env.ts` — canonical `IS_PROD` / `IS_DEV` / `DEV_BYPASS` / `USE_MOCKS` / `API_BASE_URL` / `API_V1_URL`.
> - `lib/telemetry.ts` — pluggable error reporter (`setErrorReporter`); ErrorBoundary + axios feed it.
> - `lib/tokenStore.ts` — access token in-memory only; refresh token sessionStorage-only with legacy-key eviction.
> - `services/api.ts` — fixed refresh-path duplication (now `${API_V1_URL}/auth/refresh`); WeakSet retry tracking; AUTH_REFRESHED_EVENT / AUTH_LOGGED_OUT_EVENT broadcasts; mock fallbacks gated strictly behind `USE_MOCKS`; CSRF + X-Requested-With injected on every mutating call; `publicApi.stats()`.
> - `services/skillsApi.ts` — single canonical home; convenience aliases preserved; api.ts re-exports it.
> - `services/index.ts` — barrel pointing only at services/* (no more `../api/*`).
> - `services/{networking,planner,workspace,resumeVersions,watchlists}Api.ts` — moved from `src/api/` (where they were authoritative) into the canonical services/ folder; singular aliases kept.
> - `context/AuthContext.tsx` — memory-only User state (no localStorage); `signUp({ name, email, password })` object signature with username-collision retry; `/auth/me` hydration on mount + on AUTH_REFRESHED_EVENT; honest deps; `updateProfile` re-hydrates via `/auth/me`.
> - `components/ProtectedRoute.tsx` — shared `DEV_BYPASS`; AdminRoute checks `user.role === 'ADMIN'` and toasts on deny.
> - `pages/Login.tsx` — DEV_BYPASS gated only by env var (no `MODE === 'development'` auto-bypass); real social-proof from `publicApi.stats()`; Google placeholder removed; `redirected` ref prevents flicker; uses `err.normalizedMessage`; links to `/signup`.
> - `pages/Signup.tsx` — object-based `signUp({ name, email, password })`; `unknown`-typed catch; rejects "Fair" passwords client-side; navigates to `/onboarding` after success.
> - `pages/ForgotPasswordPage.tsx` + `pages/ResetPasswordPage.tsx` — split from PasswordRecovery; reset page strictly redirects to `/forgot-password` when no `?token=`; `resetPassword(token, newPassword)` argument order is correct.
> - `pages/PasswordRecovery.tsx` — thin shim that dispatches by URL path for any old import.
> - `pages/BillingPage.tsx` — graceful "coming soon" with notify-me CTA (no half-baked Stripe UI calling a non-existent backend).
> - `components/ErrorBoundary.tsx` — production-safe fallback; `RouteFallback` is route-aware (no Dashboard→Dashboard loop); `__last_error` global pollution removed; reset uses key bump.
> - `App.tsx` — `RouteWithBoundary` helper removes ~250 lines of duplication; `/signup` canonical (`/register` redirects); separate password routes; `withPreload(...)` exposes `.preload()` on every lazy chunk; `lazyPages` exported for sidebar hover-warming.
> - `main.tsx` — wraps app in `QueryClientProvider`; sane defaults (no retry on 4xx, no refetch on focus); default telemetry sink.
> - Deleted: `src/api/` directory entirely; root-level `InterviewKitPanel.tsx` / `MockInterview.tsx` / `ProgressCharts.tsx` / `StreakBadges.tsx` duplicates; `components/skills/useSkill.ts` (renamed to `useQuickSkill.ts` to break collision with `@/hooks/useSkill`).
> - All 17 consumer imports migrated to `@/services/*` paths.

### 6.001 — Signup.handleSubmit calls signUp(email, password, name) but useAuth signature is (name, email, password)
- **[Severity]:** Critical
- **[Location]:** frontend/src/pages/Signup.tsx:46 vs frontend/src/context/AuthContext.tsx:105
- **[The Issue]:** Argument order swapped — at signup, `email` is sent as `name`, `password` as `email`, `name` as `password`; account is created with email-shaped name and password-shaped email; downstream login fails on the real email; password set to user's intended name; bcrypt verifies only the swapped value.
- **[The Fix/Implementation]:** Change Signup.tsx call to `signUp(name, email, password)`; add a unit test asserting the order; consider passing as object `{name, email, password}` to prevent positional bugs.

### 6.002 — Signup form links to /signup but App.tsx route is /register
- **[Severity]:** High
- **[Location]:** frontend/src/pages/Login.tsx:203, App.tsx:77 (`/register`)
- **[The Issue]:** `<Link to="/signup">` is a dead link — clicking lands on `<NotFound>`; users on the login page cannot reach signup; conversion funnel completely broken.
- **[The Fix/Implementation]:** Either change route to `/signup` in App.tsx (preferred, more conventional), or change all links to `/register`.

### 6.003 — Login DEV_BYPASS auto-activates in dev mode without explicit env flag
- **[Severity]:** Critical
- **[Location]:** frontend/src/pages/Login.tsx:7
- **[The Issue]:** `DEV_BYPASS = ... || import.meta.env.DEV || import.meta.env.MODE === 'development'` — running `npm run dev` (default DEV mode) auto-bypasses authentication; if a developer accidentally exposes a dev-mode build (e.g. via `vite preview` or pushing dist), anyone can log in as an arbitrary user.
- **[The Fix/Implementation]:** Remove DEV/MODE clause; require explicit `VITE_DEV_BYPASS_GUARDS=true` env var (matches AuthContext logic).

### 6.004 — ProtectedRoute and AuthContext have inconsistent DEV_BYPASS gates
- **[Severity]:** High
- **[Location]:** frontend/src/components/ProtectedRoute.tsx:20 vs AuthContext.tsx:60
- **[The Issue]:** ProtectedRoute checks ONLY env var; AuthContext also checks `MODE !== 'production'`; behaviour diverges if env var ever leaks into prod.
- **[The Fix/Implementation]:** Centralise DEV_BYPASS check in `lib/devFlags.ts`; export a single boolean; both consumers import.

### 6.005 — AdminRoute checks `user.role !== 'ADMIN'` but User entity has no role column
- **[Severity]:** Critical
- **[Location]:** frontend/src/components/ProtectedRoute.tsx:68
- **[The Issue]:** Backend User entity (Pass 4) has no `role` field; backend never returns a role; `user.role` is undefined; `undefined !== 'ADMIN'` is true; every authenticated user is redirected to /dashboard; ADMIN ROUTES UNREACHABLE.
- **[The Fix/Implementation]:** Add `role` column to User entity, populate based on AdminEmail allowlist or a `roles` table; expose in /auth/me response; or replace with internal-secret-header-based admin auth like AdminController already uses.

### 6.006 — useEffect in AuthContext references `setUser` in deps but eslint-disabled
- **[Severity]:** Low
- **[Location]:** frontend/src/context/AuthContext.tsx:86-93
- **[The Issue]:** `// eslint-disable-line react-hooks/exhaustive-deps` hides a real bug: setUser is recreated each render (useCallback dep is `[]`), so deps are stable, but if logic changes it'll be silently broken.
- **[The Fix/Implementation]:** Add setUser to deps; useCallback dep is `[]`, stable; or move setUser into the effect.

### 6.007 — AuthContext.signUp generates username from email — collisions inevitable
- **[Severity]:** High
- **[Location]:** frontend/src/context/AuthContext.tsx:109-110
- **[The Issue]:** `username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '')` — two users `john@gmail.com` and `john@yahoo.com` produce same `john` username; backend rejects with 409; frontend doesn't fall back to a unique value; users hit a dead-end at signup.
- **[The Fix/Implementation]:** Append a numeric suffix on collision (`john1`, `john2`); or let user supply username; or remove username field entirely and use email everywhere.

### 6.008 — AuthContext.updateProfile calls profileApi.get() returning UserProfile but assigns to setUser (User type mismatch)
- **[Severity]:** Medium
- **[Location]:** frontend/src/context/AuthContext.tsx:127-129
- **[The Issue]:** `setUser(freshUser)` where freshUser is a User from /profile; backend /profile likely returns ProfileResponse not User; type cast hides shape mismatch; runtime: missing fields like `username`, `name`.
- **[The Fix/Implementation]:** Verify /profile shape; if it's profile only, add a separate /auth/me call to refresh user.

### 6.009 — AuthContext localStorage persists user object — XSS exfiltration target
- **[Severity]:** Medium
- **[Location]:** frontend/src/context/AuthContext.tsx:78
- **[The Issue]:** `localStorage.setItem('co_user', ...)` includes email + onboarded; survives tab close; any XSS vector reads it; couples to access token (sessionStorage) — inconsistent threat model.
- **[The Fix/Implementation]:** Move to in-memory state only; rely on /auth/me for re-fetch on reload.

### 6.010 — App.tsx `/register` route exists but link is `/signup` — duplicate confusion
- **[Severity]:** Low
- **[Location]:** App.tsx:77, Login.tsx:203
- **[The Issue]:** Mixing nomenclature (one canonical name needed); also App.tsx `/forgot-password` and `/reset-password` both render PasswordRecovery — same component for two flows; if it doesn't read URL distinction, broken.
- **[The Fix/Implementation]:** Audit PasswordRecovery to handle both routes; or split into ForgotPassword + ResetPassword pages.

### 6.011 — Two parallel API directories: src/api/ and src/services/ — duplicate modules
- **[Severity]:** High
- **[Location]:** frontend/src/api/*.ts and frontend/src/services/*.ts
- **[The Issue]:** autoApplyApi, networkingApi, plannerApi, etc. exist in BOTH directories with same name; some components import one, some the other; updates to one don't reach the other; behaviour differs.
- **[The Fix/Implementation]:** Delete src/api/ entirely (or merge into services); update all imports to single path.

### 6.012 — Two skillsApi modules: src/services/api.ts (skillsApi export) and src/services/skillsApi.ts (separate file)
- **[Severity]:** High
- **[Location]:** frontend/src/services/api.ts:301-379, frontend/src/services/skillsApi.ts
- **[The Issue]:** Same exported name `skillsApi` from two locations; SkillPanel.tsx imports `../../services/skillsApi`; other code imports from `services/api`; two definitions diverge over time.
- **[The Fix/Implementation]:** Pick one; remove the other; rename to disambiguate (`skillsApi.ts` for canonical).

### 6.013 — Multiple duplicate component pairs (InterviewKitPanel, MockInterview, ProgressCharts, StreakBadges, useSkill)
- **[Severity]:** High
- **[Location]:** frontend/src/components/InterviewKitPanel.tsx vs interview/InterviewKitPanel.tsx; ProgressCharts.tsx vs progress/ProgressCharts.tsx; etc.
- **[The Issue]:** Same component implemented twice; bug fixes applied to one not the other; visual drift; bundle size doubled.
- **[The Fix/Implementation]:** Identify which is canonical (likely the namespaced ones); delete duplicates; update all imports.

### 6.014 — useSkill hook duplicated: src/hooks/useSkill.ts AND src/components/skills/useSkill.ts
- **[Severity]:** High
- **[Location]:** frontend/src/hooks/useSkill.ts AND frontend/src/components/skills/useSkill.ts
- **[The Issue]:** Same hook name in two places; React's rule is one source per logic; subtle state bugs from divergent implementations.
- **[The Fix/Implementation]:** Pick one (hooks/ is conventional); delete the other; redirect all imports.

### 6.015 — Login button has dead "Continue with Google" — half-baked OAuth
- **[Severity]:** Medium
- **[Location]:** frontend/src/pages/Login.tsx:187-198
- **[The Issue]:** Renders Google button but no onClick handler — clicking does nothing; user expects OAuth flow; broken signal.
- **[The Fix/Implementation]:** Either implement Google OAuth (Spring `oauth2-resource-server` already in pom — see 1.045) or remove the button.

### 6.016 — Login displays hardcoded fake stats ("2,400+ Irish jobs", "500+ Job seekers")
- **[Severity]:** Medium
- **[Location]:** frontend/src/pages/Login.tsx:10-14
- **[The Issue]:** Hardcoded social-proof numbers; misleading prospects; legally questionable in some jurisdictions if false.
- **[The Fix/Implementation]:** Either remove (prefer) or expose live counts via `/public/stats` endpoint; refresh nightly.

### 6.017 — Login error UX: shows "err.message" not the API error
- **[Severity]:** Medium
- **[Location]:** frontend/src/pages/Login.tsx:51
- **[The Issue]:** Axios interceptor sets `err.normalizedMessage` with API's structured error; Login uses `err.message` (generic Axios string); user sees "Network Error" instead of "Email already in use".
- **[The Fix/Implementation]:** Read `err.normalizedMessage` first, fall back to `err.message`.

### 6.018 — Login.useEffect redirects on user state change but no debounce — flicker risk
- **[Severity]:** Low
- **[Location]:** frontend/src/pages/Login.tsx:21-26
- **[The Issue]:** If user toggles between null and value during refresh, multiple navigates fire.
- **[The Fix/Implementation]:** Track "redirected" flag; redirect once; useRef gate.

### 6.019 — Signup uses `err: any` despite project claim "F1 fix: eliminated all `any` types"
- **[Severity]:** Low
- **[Location]:** frontend/src/pages/Signup.tsx:48
- **[The Issue]:** `catch (err: any)` slips through TS strictness; codebase claims to have removed all `any`.
- **[The Fix/Implementation]:** `catch (err: unknown) { const message = err instanceof Error ? err.message : 'Sign up failed'; }`.

### 6.020 — Signup.strengthLabel allows "Fair" passwords — backend accepts ≥8 chars but no complexity
- **[Severity]:** Medium
- **[Location]:** frontend/src/pages/Signup.tsx:38-44
- **[The Issue]:** Frontend rejects "Too short"/"Weak" but accepts "Fair" (1 of upper/digit/special); backend accepts anything ≥8 chars (Pass 5 #5.007); frontend stricter than backend, leaks weak passwords.
- **[The Fix/Implementation]:** Backend enforces complexity (5.007 fix); frontend is informational; reject also "Fair" client-side.

### 6.021 — TokenStore stores access token in sessionStorage — refresh token in localStorage
- **[Severity]:** Medium
- **[Location]:** frontend/src/lib/tokenStore.ts:18-66
- **[The Issue]:** Both still XSS-readable; sessionStorage doesn't survive new tab (good for blast radius but a new tab is forced re-login despite a valid refresh token); inconsistent UX. HttpOnly cookie is the standard.
- **[The Fix/Implementation]:** Move to httpOnly cookie set by middleware; remove tokenStore for access tokens; double-submit pattern for CSRF; aligns with what server.ts already provides via `co_csrf` cookie.

### 6.022 — api.ts baseURL uses VITE_MIDDLEWARE_URL but .env.example uses VITE_API_URL
- **[Severity]:** High
- **[Location]:** frontend/src/services/api.ts:57 vs .env.example:15
- **[The Issue]:** `import.meta.env.VITE_MIDDLEWARE_URL || 'http://localhost:4000'` — dev fills `VITE_API_URL` per docs; runtime falls back to localhost:4000; production deploy with `VITE_API_URL=https://api.example.com` does NOT set MIDDLEWARE_URL → app calls localhost in browser, fails immediately.
- **[The Fix/Implementation]:** Standardise on one variable; update docs and code together.

### 6.023 — api.ts URL rewriting `config.url?.startsWith('/api/')` strips /api prefix
- **[Severity]:** Medium
- **[Location]:** frontend/src/services/api.ts:83-85
- **[The Issue]:** baseURL already includes `/api`; this rewriter strips literal `/api/` prefix from request URLs; but some controllers don't have `/api` (Pass 2 #2.014); double-prefix or wrong path.
- **[The Fix/Implementation]:** Audit all calls; make api.ts paths consistent; remove the rewrite or move to controller-level.

### 6.024 — api.ts CSRF interceptor reads cookie value but middleware may set HttpOnly
- **[Severity]:** Medium
- **[Location]:** frontend/src/services/api.ts:66-69,93-98
- **[The Issue]:** `document.cookie.match(/co_csrf=...)` requires cookie NOT HttpOnly; if security best practice flips middleware to HttpOnly, CSRF token unreadable; all mutating requests 403.
- **[The Fix/Implementation]:** Document that `co_csrf` MUST be `HttpOnly: false`; add ArchUnit-style server.ts test asserting flag; confirm in Pass 9.

### 6.025 — api.ts.refreshFlow uses `originalRequest._retry` flag — but Axios retries spawn new configs
- **[Severity]:** Low
- **[Location]:** frontend/src/services/api.ts:120-186
- **[The Issue]:** `originalRequest._retry` mutates the same object; if same request retries via React Query, the `_retry` flag persists across renders.
- **[The Fix/Implementation]:** Reset `_retry` after successful refresh; or use a WeakSet keyed on the request.

### 6.026 — api.ts.refresh callback path `${baseURL}/api/auth/refresh` — duplicate /api in URL
- **[Severity]:** High
- **[Location]:** frontend/src/services/api.ts:164-168
- **[The Issue]:** baseURL = `${VITE_MIDDLEWARE_URL}/api` (line 72); then `axios.post(`${baseURL}/api/auth/refresh`)` → `http://localhost:4000/api/api/auth/refresh`; refresh endpoint never resolves; users force-logged-out on first 401.
- **[The Fix/Implementation]:** Use plain `${baseURL}/auth/refresh` since baseURL already includes /api.

### 6.027 — api.ts.refresh stores new tokens via tokenStore.set but doesn't refresh User in AuthContext
- **[Severity]:** Low
- **[Location]:** frontend/src/services/api.ts:164-175
- **[The Issue]:** New token issued; user object in AuthContext untouched; if refresh changed any user field, UI stale.
- **[The Fix/Implementation]:** After refresh, call `/auth/me` and update AuthContext via a global event or callback.

### 6.028 — Pages don't share a centralized error toaster — silent failures
- **[Severity]:** Medium
- **[Location]:** Login, Signup, Profile, etc. each `setError` locally
- **[The Issue]:** Errors shown inline only; no global toast for non-form errors (jobs.fetch failures); user clicks "Fetch more" → nothing happens silently.
- **[The Fix/Implementation]:** Wrap mutating operations in `react-hot-toast.promise(...)` everywhere.

### 6.029 — Page components don't memo expensive renders
- **[Severity]:** Low
- **[Location]:** Most pages
- **[The Issue]:** Re-renders on every parent re-render; with React 18 + StrictMode, double renders compound.
- **[The Fix/Implementation]:** Use `React.memo`, `useMemo`, `useCallback` on heavy lists/charts.

### 6.030 — JobsList page (likely Dashboard) renders all jobs without virtualisation
- **[Severity]:** Medium (pending verification)
- **[Location]:** Dashboard.tsx / Dashboard.impl.tsx
- **[The Issue]:** Returning 100+ JobCardResponse renders 100+ DOM elements; with avatars, scoring circles, etc., layout cost is high.
- **[The Fix/Implementation]:** Use `react-window` or `@tanstack/react-virtual` for >50 rows.

### 6.031 — Pages bypass React Query — manual fetch / useState pattern repeats
- **[Severity]:** Medium
- **[Location]:** Most pages (despite `@tanstack/react-query` being a dep)
- **[The Issue]:** `useEffect` + `setData` everywhere; no caching, no dedup, no stale-while-revalidate; same data fetched on every navigation.
- **[The Fix/Implementation]:** Migrate to `useQuery` / `useMutation`; centralised query keys; instant UI on revisit.

### 6.032 — VITE_USE_MOCKS toggles between real and mock — but some api functions don't check
- **[Severity]:** Low
- **[Location]:** services/api.ts (most have checks), services/networkingApi.ts (verify)
- **[The Issue]:** Inconsistent mock coverage; in mock-mode, some pages fail because real API attempted; bad dev UX.
- **[The Fix/Implementation]:** Higher-order wrapper: `withMock(realFn, mockFn)`; apply uniformly.

### 6.033 — Dashboard.tsx and Dashboard.impl.tsx coexist — code split with no clear handoff
- **[Severity]:** Medium
- **[Location]:** frontend/src/pages/Dashboard.tsx, Dashboard.impl.tsx
- **[The Issue]:** Half-baked migration; one file imports the other; bugs only fixed in one place; navigation may pick the wrong impl.
- **[The Fix/Implementation]:** Inspect both; consolidate; delete unused.

### 6.034 — ErrorBoundary fallback is the same `RouteFallback` for every route
- **[Severity]:** Low
- **[Location]:** frontend/src/App.tsx:50-55
- **[The Issue]:** Same generic message "X failed to load. Go to Dashboard"; if Dashboard itself fails, link is to itself; loop.
- **[The Fix/Implementation]:** When the failed route is /dashboard, link to /login or /onboarding instead.

### 6.035 — App-level ErrorBoundary swallows render errors with no Sentry/telemetry
- **[Severity]:** High
- **[Location]:** frontend/src/components/ErrorBoundary.tsx (referenced)
- **[The Issue]:** Errors caught but not reported to Sentry/Bugsnag; production crashes invisible; no metric on rate.
- **[The Fix/Implementation]:** Inside componentDidCatch, call `Sentry.captureException(error, { contexts: { react: errorInfo } })`; show user a "report" button.

### 6.036 — Routes use lazy loading but no loading boundary — flicker between routes
- **[Severity]:** Low
- **[Location]:** frontend/src/App.tsx:20-46
- **[The Issue]:** Lazy chunks load fresh on every navigation; no SWR-style preload; user sees PageLoader spinner repeatedly.
- **[The Fix/Implementation]:** Preload likely-next routes on hover (`<Link onMouseEnter={() => Dashboard.preload()}>`).

### 6.037 — `import.meta.env.MODE` checks scattered — no single boolean
- **[Severity]:** Low
- **[Location]:** AuthContext.tsx, Login.tsx, ProtectedRoute.tsx, api.ts
- **[The Issue]:** Five different DEV-mode checks; if you want to flip prod-vs-dev behaviour, must edit each.
- **[The Fix/Implementation]:** Single `lib/env.ts` exporting `IS_PROD`, `IS_DEV`, `DEV_BYPASS`.

### 6.038 — PasswordRecovery handles both /forgot-password and /reset-password — bidirectional flow
- **[Severity]:** Medium (pending detailed read)
- **[Location]:** frontend/src/pages/PasswordRecovery.tsx
- **[The Issue]:** One component for two flows; URL parsing logic critical; if missing, both routes render the same wrong UX.
- **[The Fix/Implementation]:** Split into ForgotPasswordPage and ResetPasswordPage.

### 6.039 — Onboarding page may bypass the actual onboarding state
- **[Severity]:** Medium (pending detailed read)
- **[Location]:** frontend/src/pages/Onboarding.tsx
- **[The Issue]:** ProtectedRoute redirects to /onboarding when !onboarded; if Onboarding finishes without setting `onboarded=true`, user gets infinite redirect.
- **[The Fix/Implementation]:** Verify Onboarding calls profileApi.update({ onboardingCompleted: true }) and AuthContext.updateProfile bumps user.

### 6.040 — Frontend BillingPage exists but no Stripe library imported
- **[Severity]:** Critical
- **[Location]:** frontend/src/pages/BillingPage.tsx
- **[The Issue]:** Stripe key in middleware/.env.example (Pass 1 #1.055); frontend BillingPage exists; but `package.json` shows no `@stripe/stripe-js` or `@stripe/react-stripe-js`; billing UI cannot collect payment.
- **[The Fix/Implementation]:** Add stripe-js + react-stripe-js; integrate Stripe Elements; or remove BillingPage until ready.

### 6.041 — ExperimentDashboardPage protected by AdminRoute which is broken (6.005)
- **[Severity]:** High
- **[Location]:** frontend/src/App.tsx:210-216
- **[The Issue]:** Admin can't access experiments page because AdminRoute denies all users (no role).
- **[The Fix/Implementation]:** Same fix as 6.005.

### 6.042 — Frontend imports `@/types` but path resolution depends on tsconfig paths
- **[Severity]:** Low
- **[Location]:** Many files (`import { User } from '@/types'`)
- **[The Issue]:** Vite + TS need `paths` config to resolve `@/`; if tsconfig drift, IDE breaks.
- **[The Fix/Implementation]:** Audit tsconfig.json for `paths: { "@/*": ["./src/*"] }`; same in vite.config.ts via `resolve.alias`.

### 6.043 — App.tsx wraps every route with ErrorBoundary + Suspense — heavy duplication
- **[Severity]:** Low
- **[Location]:** frontend/src/App.tsx:71-216
- **[The Issue]:** ~25 routes each wrapped identically; ~250 lines of repetition; one missed route loses error isolation.
- **[The Fix/Implementation]:** Extract `<RouteWithErrorBoundary route={..} component={..} label={..} />` helper; reduce to 5-line declarations.

### 6.044 — App.tsx forgot-password and reset-password are aliases to the same component
- **[Severity]:** Low
- **[Location]:** frontend/src/App.tsx:83-93
- **[The Issue]:** Same PasswordRecovery used; URL distinguishes; if `?token=...` decides flow, missing param produces wrong UI.
- **[The Fix/Implementation]:** Consider explicit two-step flow or robust URL handling.

### 6.045 — AuthContext.useEffect calls authApi.me() but no /auth/me endpoint exists in backend AuthController
- **[Severity]:** Critical
- **[Location]:** AuthContext.tsx:89, AuthController.java
- **[The Issue]:** Frontend hits GET /auth/me on every mount; backend has no such endpoint; returns 404; AuthContext calls .catch and sets user to null; sessionLoading becomes false; users stay logged-out forever after refresh, even with valid tokens.
- **[The Fix/Implementation]:** Add `@GetMapping("/me") public UserDto me(@RequestAttribute("userId") String uid)` to AuthController; or change frontend to call /profile.

### 6.046 — AuthContext stores user in localStorage as 'co_user' — key duplicated in mocks
- **[Severity]:** Low
- **[Location]:** frontend/src/context/AuthContext.tsx:64-66,78
- **[The Issue]:** Same key may collide with services/mockApi MOCK_USER lifecycle; mock-mode toggle leaves stale entries.
- **[The Fix/Implementation]:** Document key namespace; clear on mock-mode switch.

### 6.047 — App.tsx admin route is reachable by direct URL even if AdminRoute denies (since AdminRoute returns Navigate to /dashboard for non-admins) — fine, but no toast message
- **[Severity]:** Low
- **[Location]:** ProtectedRoute.tsx:69
- **[The Issue]:** Silent redirect to /dashboard when non-admin tries /admin/experiments; user wonders what happened.
- **[The Fix/Implementation]:** Show toast.warn("Admin access required").

---

<a id="pass-7"></a>
## Pass 7 — Frontend Components

### 7.001 — ErrorBoundary leaks raw error.message to user
- **[Severity]:** Medium
- **[Location]:** frontend/src/components/ErrorBoundary.tsx:68-72
- **[The Issue]:** Renders `<pre>{this.state.error.message}</pre>` — internal stack-relevant strings ("UUID format invalid", "Cannot read properties of undefined") leak to end users; security scanners flag.
- **[The Fix/Implementation]:** Show a generic message in production; show details only when `import.meta.env.DEV`.

### 7.002 — ErrorBoundary stores error on `(window as any).__last_error`
- **[Severity]:** Low
- **[Location]:** frontend/src/components/ErrorBoundary.tsx:44
- **[The Issue]:** `as any` cast and global pollution; confuses dev tools; not used for telemetry, just memory leak.
- **[The Fix/Implementation]:** Remove or replace with `Sentry.captureException(error)`.

### 7.003 — ErrorBoundary "Try again" only resets the boundary — doesn't re-fetch failed data
- **[Severity]:** Low
- **[Location]:** frontend/src/components/ErrorBoundary.tsx:48-50
- **[The Issue]:** Resets hasError to false, child renders again; if the child failed because of bad data still in state, it errors again immediately.
- **[The Fix/Implementation]:** Provide an `onReset` callback prop; pages opt-in to refresh queries.

### 7.004 — KanbanBoard imports from `@/services/api` but uses raw kanbanApi without retry
- **[Severity]:** Low
- **[Location]:** frontend/src/components/kanban/KanbanBoard.tsx:2
- **[The Issue]:** Drag-and-drop calls api.patch; any network blip leaves the card visually moved but DB unchanged; no rollback animation.
- **[The Fix/Implementation]:** Use react-query mutation with optimistic update + rollback onError.

### 7.005 — KanbanBoard color tokens hardcoded — Tailwind classes inside string objects
- **[Severity]:** Low
- **[Location]:** frontend/src/components/kanban/KanbanBoard.tsx:9-79
- **[The Issue]:** Tailwind v3+ requires class names appear literally; dynamic strings via record values may be purged in production CSS, killing styles.
- **[The Fix/Implementation]:** Add a `safelist` in `tailwind.config.js` for these classes; or restructure to literal strings.

### 7.006 — SkillPanel casts `data as any` for Phase 2 panels
- **[Severity]:** Medium
- **[Location]:** frontend/src/components/skills/SkillPanel.tsx:138-149
- **[The Issue]:** Unsafe `as any` casts bypass TypeScript guarantees; if backend response shape changes, panel receives malformed data and renders broken UI without a compile-time warning.
- **[The Fix/Implementation]:** Define typed response per skill (e.g. `CoverLetterOutput`, `SalaryNegotiationOutput`) and cast via `as CoverLetterOutput` with runtime validation (zod).

### 7.007 — SkillPanel handler swallows download errors silently
- **[Severity]:** Low
- **[Location]:** frontend/src/components/skills/SkillPanel.tsx:45-52
- **[The Issue]:** `try { await skillsApi.downloadSkillPdf(...) } finally { setDownloading(false) }` — no catch; download fails silently with no toast.
- **[The Fix/Implementation]:** Wrap in `toast.promise(downloadFn, { loading, success, error })`.

### 7.008 — Multiple component duplications already noted (6.013, 6.014) — same pattern affects InterviewKitPanel etc.
- **[Severity]:** High
- **[Location]:** see 6.013
- **[The Issue]:** Duplicate components produce divergent fixes.
- **[The Fix/Implementation]:** Audit imports; consolidate.

### 7.009 — Dashboard.impl.tsx and Dashboard.tsx — no clear ownership
- **[Severity]:** Medium (covered in 6.033)
- **[Location]:** frontend/src/pages/Dashboard.tsx, Dashboard.impl.tsx
- **[The Issue]:** Two copies of dashboard; uncertain which loads.
- **[The Fix/Implementation]:** Verify import in App.tsx (lazy load Dashboard); delete unused.

### 7.010 — Tailwind dark: classes everywhere but no theme toggle visible
- **[Severity]:** Low
- **[Location]:** SkillPanel.tsx:57+ (every component has `dark:bg-...`)
- **[The Issue]:** Project supports dark mode in classes but no `useTheme` hook found; means dark mode only when OS preference matches; user has no toggle.
- **[The Fix/Implementation]:** Add ThemeProvider context; localStorage persistence; toggle in settings.

### 7.011 — Components import lucide-react v1.x — far behind current
- **[Severity]:** Low
- **[Location]:** frontend/package.json:25 (`lucide-react: ^1.14.0`)
- **[The Issue]:** Lucide is at 0.x or 0.4xx (icon library); 1.14 is unusual; verify package; if a fork, pin to upstream.
- **[The Fix/Implementation]:** Verify via `npm view lucide-react versions`; if mistake, update to current stable.

### 7.012 — JobCard component (in ui/) — verify accessibility (alt text, ARIA)
- **[Severity]:** Medium (pending verification)
- **[Location]:** frontend/src/components/ui/JobCard.tsx
- **[The Issue]:** Cards likely use icons + match circles; without aria-label, screen readers see numbers/icons only.
- **[The Fix/Implementation]:** Add `role="article"` + `aria-label` describing job title, company, match.

### 7.013 — UI components don't expose `forwardRef` — composability limited
- **[Severity]:** Low
- **[Location]:** frontend/src/components/ui/Button.tsx, Input.tsx (suspected pattern)
- **[The Issue]:** Without forwardRef, cannot pass refs from form libraries (RHF) or for focus management.
- **[The Fix/Implementation]:** Wrap with React.forwardRef.

### 7.014 — Tooltip component — verify Radix UI mount/unmount when route changes
- **[Severity]:** Low (pending verification)
- **[Location]:** frontend/src/components/ui/Tooltip.tsx
- **[The Issue]:** Radix portals can leak DOM nodes if not properly unmounted on route transitions.
- **[The Fix/Implementation]:** Audit; ensure Provider scoped at App level.

### 7.015 — DevModeBanner exists in /components/ui — visible in production if env var leaks
- **[Severity]:** Medium
- **[Location]:** frontend/src/components/ui/DevModeBanner.tsx
- **[The Issue]:** "DEV MODE" banner intentionally shown when DEV_BYPASS true; if production deploy has the env var, banner appears for all users.
- **[The Fix/Implementation]:** Component MUST also check `import.meta.env.MODE === 'development'`; refuse to render in prod.

### 7.016 — ContextualHelpTip / ProductTour use motion library but possibly miss reduced-motion
- **[Severity]:** Low
- **[Location]:** frontend/src/components/onboarding/*
- **[The Issue]:** Framer-motion animates aggressively; users with vestibular disorders or `prefers-reduced-motion` not respected.
- **[The Fix/Implementation]:** Wrap motion components in `<MotionConfig reducedMotion="user">`.

### 7.017 — UpgradePaywall component — feature half-baked if no Stripe wired
- **[Severity]:** Medium
- **[Location]:** frontend/src/components/onboarding/UpgradePaywall.tsx
- **[The Issue]:** Paywall UI shown but no payment provider integration (6.040); user sees "upgrade" CTA that does nothing.
- **[The Fix/Implementation]:** Wire to Stripe Elements or hide UpgradePaywall until billing implementation completes.

### 7.018 — InlineCommentThread (workspace feature) without realtime/socket
- **[Severity]:** Low (pending verification)
- **[Location]:** frontend/src/components/InlineCommentThread.tsx
- **[The Issue]:** Likely poll-based; with a workspace collaboration feature, real-time updates expected by users.
- **[The Fix/Implementation]:** Add WebSocket via Spring `spring-websocket` (not currently in pom — would need addition); or accept poll with longer interval.

### 7.019 — NotificationBell + NotificationDrawer — verify polling interval / reactivity
- **[Severity]:** Low
- **[Location]:** frontend/src/components/notifications/NotificationBell.tsx, NotificationDrawer.tsx
- **[The Issue]:** If polling every 5s, server overwhelmed by N users × 12 polls/min; if no polling, badge stale.
- **[The Fix/Implementation]:** Use SSE (Server-Sent Events) for push notifications.

### 7.020 — TagInput component — sanitisation of user input not visible
- **[Severity]:** Medium (pending verification)
- **[Location]:** frontend/src/components/ui/TagInput.tsx
- **[The Issue]:** If tags rendered as raw HTML, XSS via paste; React escapes by default but third-party React renderers (markdown) may not.
- **[The Fix/Implementation]:** Audit rendering; ensure no `dangerouslySetInnerHTML` anywhere unless sanitised.

### 7.021 — Modal component — escape-key + focus trap behavior unclear
- **[Severity]:** Medium (pending verification)
- **[Location]:** frontend/src/components/ui/Modal.tsx
- **[The Issue]:** Without focus trap, keyboard users tab past modal back to underlying page; ESC may not close.
- **[The Fix/Implementation]:** Use Radix Dialog (already a dep) instead of custom Modal; provides focus trap + accessibility.

### 7.022 — Sidebar / TopBar / Navbar — three layout components possibly redundant
- **[Severity]:** Low
- **[Location]:** frontend/src/components/layout/Sidebar.tsx, TopBar.tsx, Navbar.tsx
- **[The Issue]:** Two of three may serve same purpose; design system unclear.
- **[The Fix/Implementation]:** Audit; pick one navigation pattern (sidebar OR topbar); remove the other.

### 7.023 — BottomNav for mobile but desktop Sidebar — verify responsive switching
- **[Severity]:** Low
- **[Location]:** frontend/src/components/layout/BottomNav.tsx
- **[The Issue]:** If both render simultaneously on tablets, double-nav UX.
- **[The Fix/Implementation]:** Use Tailwind `md:hidden` / `md:flex` correctly.

### 7.024 — MockInterview component (/components/MockInterview.tsx) — possibly unused after MockInterviewPanel
- **[Severity]:** Low
- **[Location]:** frontend/src/components/MockInterview.tsx
- **[The Issue]:** Naming overlap with MockInterviewPanel; one is dead.
- **[The Fix/Implementation]:** Find consumers; delete unused.

### 7.025 — Tests files exist (CoverLetterPanel.test.tsx, SkillPanel.test.tsx) but CI doesn't run them (1.052)
- **[Severity]:** High (covered in 1.052)
- **[Location]:** frontend/src/components/skills/*.test.tsx
- **[The Issue]:** Tests written but not executed; coverage not measured.
- **[The Fix/Implementation]:** Add `npm test` to CI; require minimum coverage.

### 7.026 — ProfileCompletenessAlert references missingFields directly — no XSS protection
- **[Severity]:** Low (likely safe, React escapes)
- **[Location]:** frontend/src/components/skills/ProfileCompletenessAlert.tsx
- **[The Issue]:** If backend returns missingFields with HTML markup, React still escapes; but check no dangerouslySetInnerHTML.
- **[The Fix/Implementation]:** Audit; ensure pure text rendering.

### 7.027 — RunAllSkillsButton triggers a 11-hour blocking call (per 3.055)
- **[Severity]:** High
- **[Location]:** frontend/src/components/skills/RunAllSkillsButton.tsx
- **[The Issue]:** Frontend POST /skills/run-all/{userJobId} waits up to 600s timeout; in reality backend takes much longer (3.055); user sees timeout error.
- **[The Fix/Implementation]:** Pair with backend async job (3.055 fix); button shows progress polling /run-all/{id}/status.

### 7.028 — Pages and components define icons inline as inline SVG instead of importing lucide-react
- **[Severity]:** Low
- **[Location]:** Login.tsx:191-198 (Google SVG), SkillPanel.tsx:67-71 (download SVG)
- **[The Issue]:** Inline SVG bloats bundle; lucide-react already imported elsewhere.
- **[The Fix/Implementation]:** Use lucide-react icons consistently.

### 7.029 — Skeleton / SkeletonCard render too eagerly — no animation throttle
- **[Severity]:** Low
- **[Location]:** frontend/src/components/ui/Skeleton.tsx, SkeletonCard.tsx
- **[The Issue]:** Pulse animation on every mount; if list of 50 cards, all pulsing causes layout thrashing.
- **[The Fix/Implementation]:** CSS-only pulse; cap to 5 visible skeletons via virtualisation.

### 7.030 — UI components don't expose `displayName` — DevTools shows `Anonymous`
- **[Severity]:** Enhancement
- **[Location]:** Most ui/* components
- **[The Issue]:** Hard to navigate React DevTools.
- **[The Fix/Implementation]:** Add `Component.displayName = 'Card'` etc.

---

<a id="pass-8"></a>
## Pass 8 — Frontend Hooks/Services/API/Lib/Types

### 8.001 — useSkill.handleAnswer "loop until Claude stops asking" body always returns on first iteration
- **[Severity]:** High
- **[Location]:** frontend/src/hooks/useSkill.ts:62-74
- **[The Issue]:** Comment says loop until non-QUESTION; while body sets state to waiting_answer and `return` immediately on first QUESTION; loop never iterates; comment misleads readers.
- **[The Fix/Implementation]:** Either remove the while wrapper (single-pass) or restructure so each user answer triggers next call; clarify state-machine semantics.

### 8.002 — useSkill.applyResponse type-narrows skillName: SkillName but pass site uses SkillName | null
- **[Severity]:** Low
- **[Location]:** frontend/src/hooks/useSkill.ts:110
- **[The Issue]:** Function signature claims SkillName; caller passes potentially null; TS allows because of upstream guards; fragile to refactor.
- **[The Fix/Implementation]:** Accept `SkillName | null` and guard inside; or assert non-null at call site.

### 8.003 — useSkill.downloadPdf catches and console.errors only
- **[Severity]:** Medium
- **[Location]:** frontend/src/hooks/useSkill.ts:85-94
- **[The Issue]:** Failure produces console-only message; user clicks Download, nothing happens, no toast.
- **[The Fix/Implementation]:** `toast.error('PDF download failed — try again')`; expose error state.

### 8.004 — useFileUpload reset deferred 800ms — race with second upload
- **[Severity]:** Low
- **[Location]:** frontend/src/hooks/useFileUpload.ts:74-76
- **[The Issue]:** `setTimeout(reset, 800)` fires after success; if user starts a second upload immediately, reset wipes its state.
- **[The Fix/Implementation]:** Track timer ref; clear before new upload; or remove the visual delay.

### 8.005 — useFileUpload uploader signature passes `AbortController` instead of `AbortSignal`
- **[Severity]:** Low
- **[Location]:** frontend/src/hooks/useFileUpload.ts:5
- **[The Issue]:** Convention is to pass the signal; passing the full controller leaks abort capability to uploader.
- **[The Fix/Implementation]:** Change to `signal?: AbortSignal`; uploaders consume with axios `signal` option.

### 8.006 — Hooks not StrictMode-double-invoke safe
- **[Severity]:** Medium
- **[Location]:** frontend/src/hooks/useOnboardingTracker.ts and others doing POST in useEffect
- **[The Issue]:** React 18 StrictMode fires effects twice in dev; if effect issues a POST (record activity), it doubles; analytics inflated; subtle bugs.
- **[The Fix/Implementation]:** Move POST writes out of useEffect into event handlers; or guard with useRef(false) latch.

### 8.007 — useAsync hook reinvents react-query — duplicate effort
- **[Severity]:** Low
- **[Location]:** frontend/src/hooks/useAsync.ts
- **[The Issue]:** Project already has @tanstack/react-query as a dep; useAsync duplicates loading/error/data state.
- **[The Fix/Implementation]:** Migrate callers to `useQuery`; delete useAsync.

### 8.008 — Two skillsApi modules (per 6.012) used inconsistently
- **[Severity]:** High (mirrors 6.012)
- **[Location]:** services/api.ts:301-379 and services/skillsApi.ts
- **[The Issue]:** Same identifier exported from two locations; PDF logic in one, not the other.
- **[The Fix/Implementation]:** Consolidate into a single skillsApi.ts; delete duplicate.

### 8.009 — services/mockApi.ts MOCK_USER lacks role — admin paths inaccessible even in mocks
- **[Severity]:** Medium
- **[Location]:** frontend/src/services/mockApi.ts:18-24
- **[The Issue]:** AdminRoute requires `role === 'ADMIN'` (also broken — see 6.005); mock user has no role; admin pages unreachable even in dev/mock.
- **[The Fix/Implementation]:** Add `role: 'ADMIN'` to MOCK_USER; fix backend role exposure (6.005).

### 8.010 — services/api.ts wraps every method with `.catch(() => mocks.MOCK_X)` fallback
- **[Severity]:** Medium
- **[Location]:** services/api.ts:265-284
- **[The Issue]:** jobsApi.list/detail/fetch/limits/stats silently fall back to mock data on ANY error; users see fake jobs in production after a transient API blip; hides outages.
- **[The Fix/Implementation]:** Remove `.catch(mock)`; rely solely on USE_MOCKS toggle; let real errors propagate to UI.

### 8.011 — TokenStore comment overstates XSS protection
- **[Severity]:** Medium
- **[Location]:** frontend/src/lib/tokenStore.ts:7-12
- **[The Issue]:** Refresh token in localStorage is XSS-readable; comment claims sessionStorage limits blast radius but only the access token gets that treatment.
- **[The Fix/Implementation]:** Move both to httpOnly cookies set by middleware; remove tokenStore for production paths; rely on middleware refresh.

### 8.012 — package.json @types/node ^25.6.0 — version doesn't exist (Node 25 unreleased)
- **[Severity]:** Low
- **[Location]:** frontend/package.json
- **[The Issue]:** Implausible version; resolves to a typed package that may not match runtime; might be a fork or typo.
- **[The Fix/Implementation]:** Pin to `@types/node: ^22.x` matching CI's node 20.

### 8.013 — react-helmet-async ^3 with @types/react-helmet-async — ecosystem mismatch
- **[Severity]:** Low
- **[Location]:** frontend/package.json
- **[The Issue]:** v3 is recent; types may lag; some apps see `<head>` updates not reflecting.
- **[The Fix/Implementation]:** Pin to v2 if not already on v3 features; verify `<HelmetProvider>` wraps app.

### 8.014 — Type unions in types/skills.ts not used with exhaustive switch
- **[Severity]:** Low
- **[Location]:** useSkill.applyResponse switch
- **[The Issue]:** Adding new SkillResponse type silently misses handler; default case absent.
- **[The Fix/Implementation]:** Add `default: const _e: never = res; throw new Error(...)` for compile-time exhaustiveness.

### 8.015 — services/index.ts barrel may collide on duplicate names from src/api/ (per 6.011) imports
- **[Severity]:** Low
- **[Location]:** frontend/src/services/index.ts
- **[The Issue]:** Re-exporting both api/ and services/ names produces a runtime ambiguity.
- **[The Fix/Implementation]:** Remove src/api/ entirely (per 6.011); barrel exports a single source.

### 8.016 — All API service files inconsistent on absolute vs relative URL prefixes
- **[Severity]:** Medium
- **[Location]:** services/*.ts
- **[The Issue]:** Some hit `/skills/start`, others `/api/skills/start`; baseURL strips `/api/` (6.023) inconsistently; certain calls hit wrong middleware path.
- **[The Fix/Implementation]:** Audit every call; consistent format `/skills/start`; remove the rewriter.

### 8.017 — Tests cover only 4 components/hooks out of 60+
- **[Severity]:** High (mirrors 7.025)
- **[Location]:** frontend/src/components/skills/*.test.tsx + hooks/useSkill.test.ts
- **[The Issue]:** Coverage minimal; CI doesn't run tests anyway (1.052).
- **[The Fix/Implementation]:** Add tests for every page, every API mocker, error states; coverage threshold ≥ 70%.

### 8.018 — types/index.ts likely re-exports types but verify circular dep
- **[Severity]:** Low (pending verification)
- **[Location]:** frontend/src/types/index.ts
- **[The Issue]:** If types reference each other across files, circular imports may surface bugs in older TS versions.
- **[The Fix/Implementation]:** Audit; ensure typed-only re-exports.

### 8.019 — Frontend lacks production logging / error reporting
- **[Severity]:** High
- **[Location]:** frontend/src/* (console.error scattered)
- **[The Issue]:** No Sentry / LogRocket / Datadog Browser SDK; production errors invisible to ops.
- **[The Fix/Implementation]:** Integrate Sentry for React; capture from ErrorBoundary; redact PII before send.

### 8.020 — Frontend lacks performance metrics (Web Vitals)
- **[Severity]:** Medium
- **[Location]:** main.tsx + App.tsx
- **[The Issue]:** No `web-vitals` reporting; cannot answer "what's our LCP" in prod.
- **[The Fix/Implementation]:** Add `web-vitals` library; ship CLS/LCP/INP to analytics.

### 8.021 — Frontend uses framer-motion ^12 but React 18; verify rerender cost
- **[Severity]:** Low
- **[Location]:** frontend/package.json
- **[The Issue]:** Animations on heavy lists trigger layout thrash; no will-change hints.
- **[The Fix/Implementation]:** Audit motion usages; respect `prefers-reduced-motion`; opt out for low-end devices.

### 8.022 — useFileStorage and useFileUpload coexist — duplicate file-handling hooks
- **[Severity]:** Low
- **[Location]:** frontend/src/hooks/useFileStorage.ts and useFileUpload.ts
- **[The Issue]:** Naming overlap suggests duplication.
- **[The Fix/Implementation]:** Audit; consolidate into one.

### 8.023 — Test setup may not configure msw for axios mock
- **[Severity]:** Low
- **[Location]:** frontend/src/test/setup.ts
- **[The Issue]:** Without msw/server, tests that call axios may hit real network in CI (when CI runs them).
- **[The Fix/Implementation]:** Use msw to mock all REST endpoints in tests.

### 8.024 — TypeScript strict mode not consistently enforced
- **[Severity]:** Medium
- **[Location]:** frontend/tsconfig.json + occurrences of `as any`/`as unknown`
- **[The Issue]:** Project claims TS strict but Signup.tsx (6.019), SkillPanel.tsx (7.006) use `any`/`as any`.
- **[The Fix/Implementation]:** Enable `strict`, `noImplicitAny`, `strictNullChecks`; add ESLint rule `@typescript-eslint/no-explicit-any`.

### 8.025 — Vite dev server proxy not visible — possible CORS misconfig
- **[Severity]:** Low
- **[Location]:** frontend/vite.config.ts
- **[The Issue]:** Without `server.proxy`, browser hits middleware directly; CORS preflight fires on every call in dev.
- **[The Fix/Implementation]:** Add `server.proxy: { '/api': 'http://localhost:4000' }`; remove cross-origin overhead.

### 8.026 — Date handling in lib/utils.ts not visible — may use raw Date
- **[Severity]:** Low (pending verification)
- **[Location]:** frontend/src/lib/utils.ts
- **[The Issue]:** Manual Date math is error-prone with TZ; backend uses Instant + LocalDateTime mix (4.002).
- **[The Fix/Implementation]:** Use date-fns or dayjs; format Instant strings consistently.

### 8.027 — services/mockApi exports stored on tab-scope `localStorage('co_user')` colliding with real
- **[Severity]:** Low (mirrors 6.046)
- **[Location]:** AuthContext + services/mockApi
- **[The Issue]:** Toggling between USE_MOCKS modes leaves stale entries; weird auth state on next switch.
- **[The Fix/Implementation]:** Namespace mock keys (`co_user_mock`).

### 8.028 — services/billingApi exists but no Stripe library — half-baked feature
- **[Severity]:** High (per 6.040)
- **[Location]:** frontend/src/services/billingApi.ts
- **[The Issue]:** API stubbed but no Stripe Elements / Checkout to call.
- **[The Fix/Implementation]:** Add @stripe/stripe-js + react-stripe-js or hide BillingPage until ready.

### 8.029 — services/discoveryApi referenced — verify all consumed
- **[Severity]:** Low (pending verification)
- **[Location]:** frontend/src/services/discoveryApi.ts
- **[The Issue]:** May overlap with jobsApi; redundant API surface invites drift.
- **[The Fix/Implementation]:** Audit consumers; consolidate.

### 8.030 — Frontend missing accessibility tests (axe / pa11y)
- **[Severity]:** Medium
- **[Location]:** frontend/src/test/setup.ts
- **[The Issue]:** No automated a11y checks; complex UI (modals, drag, charts) likely fails WCAG AA.
- **[The Fix/Implementation]:** Add `@axe-core/react` in dev; `vitest-axe` in tests; CI fails on serious violations.

### 8.031 — types/networking.ts and types/skills.ts may not align with backend DTOs
- **[Severity]:** Medium
- **[Location]:** frontend/src/types/*.ts
- **[The Issue]:** Hand-written types drift from Java DTOs; field rename in backend silently breaks frontend at runtime.
- **[The Fix/Implementation]:** Generate types from OpenAPI spec (springdoc, see 2.046); single source of truth.

### 8.032 — useInterview, usePlanner hooks (referenced) — verify single source of truth
- **[Severity]:** Low (pending verification)
- **[Location]:** frontend/src/hooks/useInterview.ts, usePlanner.ts
- **[The Issue]:** Custom hooks for domain operations might overlap with API services + react-query (if used).
- **[The Fix/Implementation]:** Either commit to react-query everywhere or keep hooks but document data ownership.

### 8.033 — services/notificationsApi vs backend NotificationController path mismatch potential
- **[Severity]:** Medium (pending verification)
- **[Location]:** frontend/src/services/notificationsApi.ts
- **[The Issue]:** Notifications routes are `/api/notifications/*` (Pass 2 inconsistency 2.014); frontend api.ts strips `/api/`; final URL may be missing prefix.
- **[The Fix/Implementation]:** Audit; ensure baseURL + path produces `/api/notifications/...` correctly.

### 8.034 — services/cvApi (referenced) — verify uploadWithProgress is implemented
- **[Severity]:** Low (pending verification)
- **[Location]:** frontend/src/services/cvApi.ts
- **[The Issue]:** useFileUpload expects an uploader with progress callback; if cvApi only has plain upload, progress is fake.
- **[The Fix/Implementation]:** Use axios `onUploadProgress` to report real bytes-transferred percentage.

### 8.035 — services/api.ts `delay` helper used in mock branches — non-deterministic test timing
- **[Severity]:** Low
- **[Location]:** frontend/src/services/api.ts:63
- **[The Issue]:** Mock paths sleep 300-2000ms; tests run slower than necessary in mock mode.
- **[The Fix/Implementation]:** Skip delay when `import.meta.env.MODE === 'test'`.

### 8.036 — services/api.ts uses `ts-ignore`/`as` casts on response types
- **[Severity]:** Low
- **[Location]:** services/api.ts (response handlers)
- **[The Issue]:** Type assertions weaken contract; backend response shape can drift without TS error.
- **[The Fix/Implementation]:** Use zod or io-ts at network boundary; typed only after parse.

### 8.037 — Frontend builds without sourcemaps in production by default — debugging hard
- **[Severity]:** Low
- **[Location]:** vite.config.ts (assumed)
- **[The Issue]:** Stack traces unreadable in prod; Sentry / LogRocket need sourcemaps.
- **[The Fix/Implementation]:** Set `build.sourcemap: 'hidden'`; upload to Sentry only; do not ship.

### 8.038 — useSkill.startSkill doesn't clear previous data before new run
- **[Severity]:** Low
- **[Location]:** frontend/src/hooks/useSkill.ts:35-51
- **[The Issue]:** Setting state to loading keeps previous `data`; UI may flash stale data during loading; user confused.
- **[The Fix/Implementation]:** Reset `data: null` and `question: null` on each startSkill.

### 8.039 — Logic to redirect on /auth/refresh failure forces full page reload `window.location.href`
- **[Severity]:** Low
- **[Location]:** frontend/src/services/api.ts:145,180
- **[The Issue]:** Loses SPA state; resets scroll, query cache, in-flight forms.
- **[The Fix/Implementation]:** Use react-router's `useNavigate('/login')` from a context-aware hook; expose programmatic logout.

### 8.040 — Frontend lacks i18n / locale handling
- **[Severity]:** Enhancement
- **[Location]:** Most pages have hardcoded English strings
- **[The Issue]:** SaaS plan to sell internationally — i18n absent; translations required for EU.
- **[The Fix/Implementation]:** Add react-intl or i18next; extract strings; backend Locale per User (per 4.007).

---

<a id="pass-9"></a>
## Pass 9 — Middleware

### 9.001 — Backend has no BillingController but middleware exposes 9 /api/billing/* routes
- **[Severity]:** Critical
- **[Location]:** middleware/src/routes/billing.routes.ts vs backend/src/main/java/com/careerops/controller/
- **[The Issue]:** All billing endpoints proxy to Java backend which has NO BillingController; every billing call returns 404 from backend → 502 from middleware; subscription/checkout/portal/cancel completely non-functional; SaaS revenue path broken.
- **[The Fix/Implementation]:** Either implement BillingController + Stripe integration in backend, or remove billing routes from middleware until ready; remove BillingPage from frontend (6.040). (Resolved)

### 9.002 — `createProxyMiddleware` routes do not inject X-Internal-Secret/X-User-Id headers
- **[Severity]:** Critical
- **[Location]:** middleware/src/routes/skills.routes.ts:14-27, billing.routes.ts:14-24
- **[The Issue]:** http-proxy-middleware forwards request headers as-is; it does NOT add the `X-Internal-Secret` or `X-Internal-User-Id` headers that backend's InternalTrustFilter requires; SkillsController works only because it parses Authorization Bearer manually (Pass 2 #2.013), but any controller relying on @RequestAttribute("userId") fails.
- **[The Fix/Implementation]:** Replace createProxyMiddleware with `forward()` helper from backendProxy.ts; or attach trust headers via the proxy's onProxyReq hook. (Resolved)

### 9.003 — Middleware env var name mismatch: JAVA_BACKEND_URL vs BACKEND_URL
- **[Severity]:** High
- **[Location]:** middleware/src/server.ts:14-18, middleware/src/services/backendProxy.ts:3, .env.example:33 (`BACKEND_URL`)
- **[The Issue]:** Code reads `JAVA_BACKEND_URL` (with mandatory check); .env.example uses `BACKEND_URL`; deployment with the documented var fails startup; deployment with the new name works but contradicts docs.
- **[The Fix/Implementation]:** Standardise on one name; update .env.example to match `JAVA_BACKEND_URL`. (Resolved)

### 9.004 — Middleware /auth/me proxies to backend /auth/me which doesn't exist
- **[Severity]:** Critical (mirror of 6.045)
- **[Location]:** middleware/src/routes/auth.routes.ts:137-145, backend AuthController
- **[The Issue]:** Frontend AuthContext mounts → calls /auth/me → middleware proxies → backend returns 404 → AuthContext clears user → infinite re-login loop.
- **[The Fix/Implementation]:** Add backend `@GetMapping("/me")` to AuthController OR change middleware to fetch user from /profile. (Resolved)

### 9.005 — Login route stores access token in cookie AND returns in body
- **[Severity]:** Medium
- **[Location]:** middleware/src/routes/auth.routes.ts:51-52,66-67,84-85
- **[The Issue]:** Cookie is httpOnly (good, XSS-safe); also sending token in body defeats the purpose because frontend stores it via tokenStore.setAccess (sessionStorage, XSS-readable).
- **[The Fix/Implementation]:** Stop returning token in body; rely solely on cookie; frontend axios uses `withCredentials: true`. (Resolved)

### 9.006 — cookieOpts secure flag toggled by env var with `lax` default sameSite
- **[Severity]:** Medium
- **[Location]:** middleware/src/routes/auth.routes.ts:28-34
- **[The Issue]:** `secure: COOKIE_SECURE === 'true'` defaults false; production deploys forgetting to set the env var send cookies over HTTP; SameSite=lax allows cross-site GET cookie.
- **[The Fix/Implementation]:** Default secure=true unless `NODE_ENV === 'development'`; SameSite=strict by default. (Resolved)

### 9.007 — forgot-password proxies backend 4xx responses verbatim → email enumeration
- **[Severity]:** Medium
- **[Location]:** middleware/src/routes/auth.routes.ts:106-115
- **[The Issue]:** `res.status(r.status).json(r.data ?? {})` — if backend returns 404 "user not found", attacker confirms emails exist; backend is supposed to silently 200 (3.004), but middleware does not enforce.
- **[The Fix/Implementation]:** Always return 202 regardless of backend response; log backend status separately. (Resolved)

### 9.008 — auth.routes.ts logout doesn't clear refreshToken on backend if logout proxy fails
- **[Severity]:** Medium
- **[Location]:** middleware/src/routes/auth.routes.ts:90-103
- **[The Issue]:** `forward(...).catch(err => console.warn(...))` — if backend logout fails, cookie is cleared client-side but refresh-token still valid on server; security gap.
- **[The Fix/Implementation]:** Re-throw on critical failures; require backend acknowledgement before clearing cookie. (Resolved)

### 9.009 — Middleware CSRF cookie is non-HttpOnly to allow JS read — risk of XSS theft
- **[Severity]:** Medium
- **[Location]:** middleware/src/server.ts:108-115
- **[The Issue]:** `httpOnly: false` is required for double-submit; XSS can read cookie and set matching header; CSRF still defeated.
- **[The Fix/Implementation]:** Pair with `Synchroniser-Token-Pattern` instead of double-submit; or rely on SameSite=Strict alone for SPAs. (Resolved)

### 9.010 — Middleware CSRF check rejects first POST before frontend reads cookie
- **[Severity]:** High
- **[Location]:** middleware/src/server.ts:118-130
- **[The Issue]:** Cookie set on first response (e.g. GET /health or first /api/something GET); but if frontend's first call is POST /api/auth/login, no cookie exists yet → 403; signup/login flow broken in clean-session.
- **[The Fix/Implementation]:** Set cookie on every response unconditionally (not only when missing); frontend pre-warms via GET /health on app boot. (Resolved)

### 9.011 — Middleware rate-limiter keyGenerator decodes JWT WITHOUT verifying signature
- **[Severity]:** High
- **[Location]:** middleware/src/server.ts:142-156
- **[The Issue]:** `Buffer.from(auth.split('.')[1], 'base64url').toString()` — payload decoded raw; attacker forges JWT with target user's `sub` to share or exhaust their rate-limit quota.
- **[The Fix/Implementation]:** Either verify the JWT (use jwt.verify, accept failure → fall back to IP) OR key on IP exclusively.

### 9.012 — Middleware rate-limiter uses in-memory store unless REDIS_URL set
- **[Severity]:** Medium
- **[Location]:** middleware/src/rateLimiter.ts:23-42
- **[The Issue]:** Same per-instance limit defeated by load balancer (mirrors backend 1.027).
- **[The Fix/Implementation]:** Document REDIS_URL as required in production; fail-fast at startup if NODE_ENV=production and not set.

### 9.013 — Middleware csrfGuard accepts X-Requested-With: xmlhttprequest case-insensitively
- **[Severity]:** Low
- **[Location]:** middleware/src/rateLimiter.ts:99-105
- **[The Issue]:** Header name comparison case-insensitive (good); but XMLHttpRequest is browser default for old AJAX; modern fetch() does NOT send XHR header automatically — frontend must add it explicitly; verify api.ts does so (it doesn't, see api.ts request interceptor).
- **[The Fix/Implementation]:** Frontend api.ts must add `X-Requested-With: XMLHttpRequest` header on every mutating request.

### 9.014 — CSP scriptSrc 'self' only — no nonce/hash for inline scripts
- **[Severity]:** Medium
- **[Location]:** middleware/src/server.ts:71-86
- **[The Issue]:** CSP blocks inline scripts; React injects inline event handlers and styles (despite styleSrc unsafe-inline allowance) — works for now, but if inline scripts ever needed, broken.
- **[The Fix/Implementation]:** Add nonce-based CSP: generate random nonce per request; expose to React via meta; allow `script-src 'self' 'nonce-{...}'`.

### 9.015 — sanitize.ts stripXss is exported but never wired into the request pipeline
- **[Severity]:** Medium
- **[Location]:** middleware/src/sanitize.ts:68-73 (defined but not imported in server.ts)
- **[The Issue]:** Defense-in-depth XSS scrubber written but never used; comment claims it protects backend echoes but middleware doesn't call it.
- **[The Fix/Implementation]:** Add `app.use(stripXss)` in server.ts after express.json(); or remove dead code.

### 9.016 — sanitize.ts stripXss removes legitimate `<` and `>` from user content
- **[Severity]:** High (if wired up)
- **[Location]:** middleware/src/sanitize.ts:43-50
- **[The Issue]:** `replace(/<[^>]+>/g, '')` strips all HTML; legitimate user input "x > y" or markdown becomes "x  y"; CV tip text containing math/comparisons silently corrupted.
- **[The Fix/Implementation]:** Use a real HTML sanitiser like sanitize-html with an allowlist; preserve plain text; only strip dangerous attributes/tags.

### 9.017 — Middleware error handler exposes backend error data to client
- **[Severity]:** Medium
- **[Location]:** middleware/src/server.ts:185-191
- **[The Issue]:** `err.response?.data?.error` echoed to client; if backend returns leaky details, they pass through.
- **[The Fix/Implementation]:** Log internally; return generic "Internal error"; expose details only in dev profile.

### 9.018 — Middleware does not propagate request-id to backend
- **[Severity]:** Medium
- **[Location]:** middleware/src/services/backendProxy.ts:13-20
- **[The Issue]:** No correlation id between middleware and backend logs; debugging cross-tier requests requires timestamp correlation.
- **[The Fix/Implementation]:** Generate `X-Correlation-Id` if absent; forward to backend; echo in response.

### 9.019 — Backend proxy `validateStatus: () => true` masks any HTTP error as 200 from axios
- **[Severity]:** Low
- **[Location]:** middleware/src/services/backendProxy.ts:7-11
- **[The Issue]:** Caller must check `r.status` manually; `bubble()` does that; but any caller using `forward()` and ignoring status will silently pass error data as success.
- **[The Fix/Implementation]:** Document; or split into `forwardOrThrow()` for callers expecting throw on 4xx/5xx.

### 9.020 — Auth signup/login `secure` cookie default false — token transit insecure
- **[Severity]:** High
- **[Location]:** middleware/src/routes/auth.routes.ts:30
- **[The Issue]:** `secure: String(process.env.COOKIE_SECURE).toLowerCase() === 'true'` defaults to false; production behind a proxy that terminates SSL might forget to set the env; cookie travels over plain HTTP.
- **[The Fix/Implementation]:** `secure: process.env.NODE_ENV === 'production'`; document override only for local-https edge case.

### 9.021 — Middleware uses `path.startsWith('/billing/webhook')` to skip CSRF — pattern brittle
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts:121
- **[The Issue]:** If any new public endpoint is added, must remember to add it; future devs miss → CSRF fails on legitimate Stripe webhook.
- **[The Fix/Implementation]:** Use a route-level decorator to mark exempt routes; or maintain an explicit exemption set.

### 9.022 — sanitize.ts trimStrings only top-level — nested strings untrimmed
- **[Severity]:** Low
- **[Location]:** middleware/src/sanitize.ts:25-32
- **[The Issue]:** Recursive structures (objects, arrays) not handled; `body.profile.name` with whitespace passes through untrimmed.
- **[The Fix/Implementation]:** Make trimStrings recursive like sanitiseDeep.

### 9.023 — Middleware doesn't validate Content-Length / payload before parsing
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts:95
- **[The Issue]:** `express.json({ limit: '2mb' })` enforces, but no early-return for huge requests; client can flood with 5MB → server parses (rejected) but burned cycles.
- **[The Fix/Implementation]:** Add nginx/cloudfront body-size cap before reaching node.

### 9.024 — Cookie names diverge: server.ts CSRF cookie `co_csrf`; auth route session cookie `co_session`; api.ts cookie reader matches `co_csrf` but no read of `co_session`
- **[Severity]:** Medium
- **[Location]:** middleware/src/server.ts:103, auth.routes.ts:26, frontend api.ts:67
- **[The Issue]:** Frontend doesn't read co_session cookie because httpOnly; but expects token from response body for tokenStore; works coincidentally; if cookie strategy changes, mismatch.
- **[The Fix/Implementation]:** Document cookie strategy: co_session is httpOnly, co_csrf is JS-readable; frontend never reads co_session.

### 9.025 — Middleware doesn't expose health-check endpoint with backend reachability
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts:158
- **[The Issue]:** `/health` returns `{ ok: true }` always; doesn't probe Java backend; LB sees middleware healthy when Java is down.
- **[The Fix/Implementation]:** /health pings Java /health; cache 5s; return composite status.

### 9.026 — Middleware loads dotenv but the .env path may differ in container deploy
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts:1 (`import 'dotenv/config'`)
- **[The Issue]:** Container deploy uses environment variables not .env file; dotenv loads from cwd; works fine but unnecessary in prod.
- **[The Fix/Implementation]:** Skip dotenv when NODE_ENV=production.

### 9.027 — Middleware allows `frameSrc: ["'self'", 'https://js.stripe.com']` but blocks frame ancestors
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts:79
- **[The Issue]:** `frame-ancestors` not set; defaults allow embedding; clickjacking surface.
- **[The Fix/Implementation]:** Add `frameAncestors: ["'none'"]` to CSP directives.

### 9.028 — Middleware does not protect against HTTP Parameter Pollution (HPP)
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts
- **[The Issue]:** Multiple `?key=a&key=b` query params produce arrays; some Express handlers expect strings; bypass validators.
- **[The Fix/Implementation]:** Add `app.use(hpp())` after express.json().

### 9.029 — Cookie SameSite default 'lax' — fine for SPA but inadequate for cross-site iframe
- **[Severity]:** Low
- **[Location]:** middleware/src/routes/auth.routes.ts:31
- **[The Issue]:** Lax allows top-level cross-site GET — typical OAuth callbacks; for pure SPA, Strict is better.
- **[The Fix/Implementation]:** Default to Strict; opt-out via env var if OAuth callbacks added.

### 9.030 — Multiple proxy patterns: `forward()` (auth.routes), `createProxyMiddleware` (skills, billing) — drift
- **[Severity]:** Medium
- **[Location]:** middleware/src/services/backendProxy.ts vs middleware/src/routes/skills.routes.ts
- **[The Issue]:** Two parallel proxy implementations — different headers, different timeouts, different error envelopes.
- **[The Fix/Implementation]:** Consolidate into single `forward()` helper used everywhere; delete createProxyMiddleware usage.

### 9.031 — All routes lack response-time middleware — no slow-request flagging
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts
- **[The Issue]:** Morgan logs requests but no per-request duration warnings; slow handlers blend into INFO logs.
- **[The Fix/Implementation]:** Add `response-time` middleware; log warn if duration > 2s.

### 9.032 — Middleware doesn't shut down gracefully on SIGTERM
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts:194
- **[The Issue]:** No SIGTERM handler; container kill mid-request drops the response; client sees 502.
- **[The Fix/Implementation]:** `process.on('SIGTERM', () => server.close(...))`; finish in-flight requests up to 30s.

### 9.033 — Middleware lacks compression brotli level config — defaults gzip-only
- **[Severity]:** Low
- **[Location]:** middleware/
- **[The Issue]:** `compression()` defaults to gzip; brotli supported by 95% browsers and saves ~20% more.
- **[The Fix/Implementation]:** Use `shrink-ray-current` or `compression-brotli`; or rely on edge (CloudFront / nginx).

### 9.034 — Routes log via morgan but `combined` format includes Authorization header in some setups
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts:100
- **[The Issue]:** Default combined doesn't include Authorization, but custom morgan tokens may be added later; risk of token leak.
- **[The Fix/Implementation]:** Document; ArchUnit-style test.

### 9.035 — Express.json limit 2MB but skill replies can include CV text > 2MB
- **[Severity]:** Medium
- **[Location]:** middleware/src/server.ts:95
- **[The Issue]:** User replies with long CV text > 2MB → 413 error before reaching backend; rare but blocks legitimate use.
- **[The Fix/Implementation]:** Raise limit to 5MB on /api/skills/* via per-route override.

### 9.036 — Routes don't use express-validator on PATCH/PUT/DELETE bodies
- **[Severity]:** Medium
- **[Location]:** Most middleware/src/routes/*.routes.ts
- **[The Issue]:** Only auth routes apply body() validators; other routes pass-through whatever client sends.
- **[The Fix/Implementation]:** Add express-validator on every state-changing route; reject malformed bodies before backend call.

### 9.037 — Middleware doesn't propagate user IP to backend for audit logs
- **[Severity]:** Low
- **[Location]:** middleware/src/services/backendProxy.ts
- **[The Issue]:** Backend AuditLog has ip_address column; middleware never forwards `X-Forwarded-For`; backend always sees middleware's IP.
- **[The Fix/Implementation]:** Forward `X-Forwarded-For: ${req.ip}` to backend; backend AuditLogService reads it.

### 9.038 — Middleware lacks structured logging (winston/pino) — only morgan
- **[Severity]:** Medium
- **[Location]:** middleware/src/server.ts
- **[The Issue]:** Morgan logs access; route handlers use `console.log/warn/error` — unstructured; cannot ship to ELK.
- **[The Fix/Implementation]:** Add pino logger; replace console.* with `logger.info/warn/error`.

### 9.039 — Stripe webhook route is mounted but no SecretKey verification visible
- **[Severity]:** Critical
- **[Location]:** middleware/src/routes/billing.routes.ts:51
- **[The Issue]:** Webhook proxied directly to Java backend; if backend doesn't verify signature, anyone hitting /api/billing/webhook can fake events; subscription state corrupted.
- **[The Fix/Implementation]:** Verify Stripe signature in middleware (or backend); reject on failure with 401.

### 9.040 — `console.error('Middleware error:', err.message)` in error handler — no JSON / aggregator format
- **[Severity]:** Low
- **[Location]:** middleware/src/server.ts:186
- **[The Issue]:** Error context lost; stack truncated; integration with log aggregator broken.
- **[The Fix/Implementation]:** Switch to pino with structured JSON; include req method/url/userId.

---

<a id="pass-10"></a>
## Pass 10 — DB schema + migrations

### 10.001 — V9 collision was renamed to V9_1; verify Flyway accepts underscore-separated minor version
- **[Severity]:** Low
- **[Location]:** backend/src/main/resources/db/migration/V9_1__notifications.sql + V9__interview_command_center.sql
- **[The Issue]:** Renaming earlier audit finding (1.001) confirmed: V9_1 is in place. Flyway parses `V9_1` as version 9.1 — distinct from V9. Comment update needed in 1.001.
- **[The Fix/Implementation]:** Document Flyway naming convention in repo README; add `.editorconfig` rule preventing `V<N>__*` plain filenames if a `V<N>__*` already exists.

### 10.002 — db/schema.sql duplicates Flyway migrations as a separate source of truth
- **[Severity]:** Critical
- **[Location]:** db/schema.sql (198 lines) vs backend/src/main/resources/db/migration/V*.sql
- **[The Issue]:** Two SQL pathways for schema: db/schema.sql ("Run in Supabase SQL editor") AND Flyway migrations; new schema changes must be added in both; drift inevitable; schemas WILL diverge over time; production environments may differ from dev.
- **[The Fix/Implementation]:** Delete db/schema.sql; rely solely on Flyway; deploy via `mvn flyway:migrate` instead of manual SQL.

### 10.003 — db/schema.sql uses career_operations schema with prefix; Flyway migrations rely on search_path
- **[Severity]:** High
- **[Location]:** db/schema.sql:7 vs backend/src/main/resources/db/migration/V1__base_schema.sql + V13/V15/V34 (`SET search_path`)
- **[The Issue]:** Mixed strategies: db/schema.sql uses fully-qualified names; some Flyway migrations use SET search_path; V1 uses neither (no schema prefix, no SET); without `spring.flyway.default-schema=career_operations`, V1 creates tables in `public`.
- **[The Fix/Implementation]:** Set `spring.flyway.default-schema=career_operations` and `spring.flyway.schemas=career_operations` in application.properties; ensure every migration starts with `SET search_path TO career_operations;` for safety.

### 10.004 — V1 schema lacks `username` column but User entity has it
- **[Severity]:** Critical
- **[Location]:** V1__base_schema.sql:5-13 vs backend/src/main/java/com/careerops/model/User.java:16
- **[The Issue]:** `users` table created without `username` column; entity declares `@Column(unique=true) username`; with `spring.jpa.hibernate.ddl-auto=validate`, application FAILS at boot ("Schema validation: missing column [username] on User"); no later migration adds username (per grep).
- **[The Fix/Implementation]:** Add Flyway migration `ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE NOT NULL` (with backfill for existing rows); or remove `username` from User entity if unused.

### 10.005 — V1 has `role VARCHAR(50)` on users but User entity has no role field
- **[Severity]:** Medium
- **[Location]:** V1__base_schema.sql:10 vs backend User.java
- **[The Issue]:** Schema declares role column; entity ignores it; admin role checks (frontend AdminRoute) impossible because backend never returns role; column is dead data.
- **[The Fix/Implementation]:** Either add `role` field to User entity + expose in /auth/me, or drop the column.

### 10.006 — V1 schema does NOT include `password_resets`, `cv_documents`, `user_profiles`
- **[Severity]:** Medium
- **[Location]:** V1__base_schema.sql lacks these
- **[The Issue]:** Entities exist, db/schema.sql includes them, but V1 doesn't; later migrations (V3 cv_documents, V4 user_profiles) add them; password_resets needs verification — if absent, OTP feature broken.
- **[The Fix/Implementation]:** Audit every entity has a corresponding Flyway create; add migrations where missing; add an integration test running Flyway on clean DB then `Hibernate.validate()`.

### 10.007 — schema.sql ENABLE ROW LEVEL SECURITY but no policies defined
- **[Severity]:** High
- **[Location]:** db/schema.sql:188-194
- **[The Issue]:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` without policies blocks ALL access through anon key (which is what Supabase clients use); backend uses service_role key (bypasses RLS) so it works; but if frontend ever uses anon directly, all reads fail.
- **[The Fix/Implementation]:** Either add policies (`CREATE POLICY user_owns_row ON user_profiles FOR ALL USING (user_id = auth.uid())`) or remove RLS until policies are written.

### 10.008 — V1 user_jobs has `notes TEXT` column but UserJob entity has no notes field
- **[Severity]:** Low
- **[Location]:** V1__base_schema.sql:33 vs UserJob entity
- **[The Issue]:** Column exists, entity ignores; orphan data; ddl-auto=validate may not complain about extra DB columns but they're dead.
- **[The Fix/Implementation]:** Either expose notes via entity + UI, or drop the column.

### 10.009 — V1 user_jobs lacks columns added later (ai_score, match_percent, matched_skills, etc.)
- **[Severity]:** Low
- **[Location]:** V1__base_schema.sql:27-37 vs UserJob entity
- **[The Issue]:** V1 only has match_percent (no ai_score, no skills arrays, no JSONB breakdown); later migrations must add these — verify they all exist.
- **[The Fix/Implementation]:** Audit V21 (`jobs_salary_columns`) and others; ensure full UserJob is producible from migration sequence.

### 10.010 — db/schema.sql jobs table has `currency` and `posted_at`; V1 jobs uses different columns
- **[Severity]:** Medium
- **[Location]:** db/schema.sql:46-62 vs V1__base_schema.sql:15-25
- **[The Issue]:** db/schema.sql jobs.currency / sponsorship / source_name; V1 has none; production deployed via Flyway differs from dev seeded via schema.sql.
- **[The Fix/Implementation]:** Either remove db/schema.sql or rebuild it from the Flyway migration sequence.

### 10.011 — V1 password_hash is VARCHAR(255) — bcrypt produces 60 chars, fits, but Argon2id needs ~100
- **[Severity]:** Low
- **[Location]:** V1__base_schema.sql:8
- **[The Issue]:** Future password-hashing upgrades (Argon2) won't fit; silent truncation possible.
- **[The Fix/Implementation]:** Use TEXT or VARCHAR(512); document.

### 10.012 — V1 idx_users_email duplicates the UNIQUE constraint's auto-index
- **[Severity]:** Low
- **[Location]:** V1__base_schema.sql:7,41
- **[The Issue]:** `email VARCHAR(255) NOT NULL UNIQUE` already creates an index; explicit `CREATE INDEX idx_users_email` adds a duplicate.
- **[The Fix/Implementation]:** Drop the explicit index.

### 10.013 — V1 has no `updated_at` triggers — only DEFAULT NOW() on create
- **[Severity]:** Medium
- **[Location]:** V1__base_schema.sql + others
- **[The Issue]:** Hibernate `@UpdateTimestamp` writes on entity update, but raw SQL UPDATE bypasses; rows go stale; no DB-level trigger to ensure updated_at always reflects last change.
- **[The Fix/Implementation]:** Add a generic `set_updated_at()` trigger; attach to every table with updated_at.

### 10.014 — V1 user_jobs `match_percent SMALLINT` but UserJob.matchPercent is Integer
- **[Severity]:** Low
- **[Location]:** V1__base_schema.sql:32 vs UserJob.matchPercent
- **[The Issue]:** SMALLINT max = 32767, fine for percentages 0-100; but Integer at JPA accepts 0..2^31-1; type mismatch silently OK on read, but on write Hibernate may issue an INT bind that PG narrows.
- **[The Fix/Implementation]:** Change column to INTEGER for consistency.

### 10.015 — V13 refresh_token index exposes hashed tokens via index lookup
- **[Severity]:** Low
- **[Location]:** V13__refresh_tokens.sql:8
- **[The Issue]:** B-tree index on `refresh_token` value; while values are hashed, the DB now has perfectly correlatable tokens — anyone with DB read can map session to user; expected behaviour but worth noting.
- **[The Fix/Implementation]:** Acceptable for hashed; document; consider dedicated refresh_tokens table (4.006).

### 10.016 — V34 audit_log table NOT pluralised — entity expects `audit_logs`
- **[Severity]:** High
- **[Location]:** V34__phase6_reliability_security.sql:5 (`audit_log`) vs AuditLog entity (`@Table(name = "audit_logs")` per Pass 4)
- **[The Issue]:** Migration creates `audit_log` (singular); entity maps to `audit_logs` (plural); ddl-auto=validate FAILS; AuditLogService never writes.
- **[The Fix/Implementation]:** Add migration `ALTER TABLE audit_log RENAME TO audit_logs;` or change entity to singular name.

### 10.017 — V34 user_sessions has `revoked` BOOLEAN but UserSession entity may use different status enum
- **[Severity]:** Medium (pending verification)
- **[Location]:** V34__phase6_reliability_security.sql:36 vs UserSession entity
- **[The Issue]:** Schema/entity field mismatch silently breaks session revocation.
- **[The Fix/Implementation]:** Verify; align names.

### 10.018 — V34 ai_token_usage uses `cost_usd NUMERIC(10,6)` — limited to 9999.999999 USD
- **[Severity]:** Low
- **[Location]:** V34__phase6_reliability_security.sql:53
- **[The Issue]:** A single skill run could approach $1 today; aggregations across users/months easily exceed 9999; column overflows silently.
- **[The Fix/Implementation]:** Use NUMERIC(15,6) or BIGINT cents.

### 10.019 — Flyway migrations not idempotent — re-running V1 fails on existing tables
- **[Severity]:** Low
- **[Location]:** V1__base_schema.sql (uses CREATE TABLE IF NOT EXISTS — actually OK)
- **[The Issue]:** Mostly idempotent due to IF NOT EXISTS; but later migrations (V34) use plain CREATE TABLE; running on a partially-populated DB fails mid-way.
- **[The Fix/Implementation]:** Add `IF NOT EXISTS` to every CREATE TABLE; or rely on Flyway's history table strictly.

### 10.020 — db/migrations/ folder uses `V_3.1__` filename — different convention from backend Flyway
- **[Severity]:** Medium
- **[Location]:** db/migrations/V_3.1__interview_command_center.sql vs backend/src/main/resources/db/migration/V*
- **[The Issue]:** Two parallel migration directories with different naming conventions; only one is wired to Flyway (the resources one); the other is dead code (or out-of-band manual).
- **[The Fix/Implementation]:** Delete db/migrations/ entirely — keep one source.

### 10.021 — RLS enabled on user_profiles, user_jobs, user_cvs, etc. — backend uses service_role bypass
- **[Severity]:** High (compounds with 3.033)
- **[Location]:** db/schema.sql:188-194
- **[The Issue]:** Backend bypasses RLS via service_role; if backend compromised, RLS provides ZERO protection; defense-in-depth weak.
- **[The Fix/Implementation]:** Use anon key + per-request signed JWT for storage; rely on Postgres RLS policies; document.

### 10.022 — No pgvector extension referenced anywhere despite MemoryEmbedding entity
- **[Severity]:** High
- **[Location]:** Migrations + db/schema.sql
- **[The Issue]:** MemoryEmbedding entity exists (Pass 4); no `CREATE EXTENSION IF NOT EXISTS vector` migration; no `vector(N)` column type used; semantic search unreachable.
- **[The Fix/Implementation]:** Add migration `CREATE EXTENSION IF NOT EXISTS vector;`; define embedding column on MemoryEmbedding; integrate Embedding service.

### 10.023 — Foreign keys do not declare ON DELETE behaviour consistently
- **[Severity]:** High
- **[Location]:** db/schema.sql user_jobs FK has CASCADE; V1 too; many later migrations may not
- **[The Issue]:** AccountController.deleteAccount comment relies on cascade ("Cascades via DB foreign keys"); each migration must add ON DELETE CASCADE for user_id FKs; missing one leaves orphans.
- **[The Fix/Implementation]:** Audit every `REFERENCES users(id)` in migrations; add ON DELETE CASCADE; integration test deletes a user and asserts no orphans.

### 10.024 — Flyway baseline-on-migrate not configured
- **[Severity]:** Low
- **[Location]:** application.properties (no `spring.flyway.baseline-on-migrate`)
- **[The Issue]:** When deploying to a DB that already has tables (e.g. Supabase post-schema.sql), Flyway refuses to baseline, fails startup.
- **[The Fix/Implementation]:** Set `spring.flyway.baseline-on-migrate=true` and `spring.flyway.baseline-version=0` for new envs.

### 10.025 — No migration for `users.email_verified_at`, `locked_until`, `failed_login_attempts`
- **[Severity]:** High
- **[Location]:** Migrations don't add these
- **[The Issue]:** Pass 4 #4.007 calls for these; not present; account-lockout / verification cannot be implemented.
- **[The Fix/Implementation]:** Add migration `ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ, ADD COLUMN failed_login_attempts INT DEFAULT 0, ADD COLUMN locked_until TIMESTAMPTZ`.

### 10.026 — JSONB columns lack GIN indexes — slow filtering
- **[Severity]:** Medium
- **[Location]:** user_jobs.score_breakdown, analytics_events.metadata, notifications.metadata, etc.
- **[The Issue]:** Querying by JSONB path requires GIN; without it, sequential scan on large tables.
- **[The Fix/Implementation]:** `CREATE INDEX gin_user_jobs_score ON user_jobs USING GIN (score_breakdown);` etc.

### 10.027 — TEXT[] columns (target_roles, tech_stack, matched_skills) lack GIN indexes
- **[Severity]:** Low
- **[Location]:** user_profiles, user_jobs
- **[The Issue]:** Search "users with tech_stack containing 'Java'" → seq scan.
- **[The Fix/Implementation]:** GIN index on each text[] column.

### 10.028 — irish_companies seed data hardcoded inside V*.sql — un-versioned changes
- **[Severity]:** Low
- **[Location]:** db/schema.sql:154-185
- **[The Issue]:** Adding a new company requires editing schema.sql; in production via Flyway, unchanged; dev/prod diverge.
- **[The Fix/Implementation]:** Move seed data to a Flyway repeatable migration `R__seed_irish_companies.sql`.

### 10.029 — daily_fetch_log uses composite PK (user_id, fetch_date) — no auto-purge
- **[Severity]:** Medium
- **[Location]:** db/schema.sql:108-113
- **[The Issue]:** Rows accumulate forever (1 row/user/day × N years); CronJobService prunes (3.067) but only via app cron; if cron fails, table grows.
- **[The Fix/Implementation]:** Add `CHECK (fetch_date > CURRENT_DATE - INTERVAL '1 year')` partition strategy or DB-side cleanup function.

### 10.030 — V1 jobs table has no `fingerprint` column — fingerprint added later? Verify
- **[Severity]:** Medium
- **[Location]:** V1__base_schema.sql:15-25 vs Job entity (`fingerprint UNIQUE NOT NULL`)
- **[The Issue]:** V1 jobs lacks fingerprint; entity REQUIRES non-null fingerprint; migration must add it; first attempt to insert via JPA without backfill fails.
- **[The Fix/Implementation]:** Audit; add `ALTER TABLE jobs ADD COLUMN fingerprint TEXT UNIQUE NOT NULL` migration with deterministic backfill from `MD5(title || company || location)`.

### 10.031 — Migrations use mixed VARCHAR sizes (50, 100, 255, 500) without justification
- **[Severity]:** Low
- **[Location]:** Migration files
- **[The Issue]:** Inconsistent length policy; renaming may exceed; just use TEXT in PG (no perf cost).
- **[The Fix/Implementation]:** Migrate VARCHAR to TEXT where size is not load-bearing.

### 10.032 — No partition strategy on large tables (audit_log, ai_token_usage, analytics_events, skill_runs)
- **[Severity]:** Medium
- **[Location]:** Migrations
- **[The Issue]:** These grow unbounded; queries by user_id scan globally; partition by time would speed up queries and enable lifecycle management.
- **[The Fix/Implementation]:** Convert to declarative partitioning by created_at month; nightly create + drop partitions.

### 10.033 — No EXTENSION IF NOT EXISTS pgcrypto for `gen_random_uuid()`
- **[Severity]:** Medium
- **[Location]:** All CREATE TABLE migrations using `gen_random_uuid()`
- **[The Issue]:** PG 13+ has `gen_random_uuid()` natively; older 12 needs `pgcrypto`; if running on 12, migrations fail.
- **[The Fix/Implementation]:** Add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at top of V1.

### 10.034 — No CHECK constraint on enum-like text columns
- **[Severity]:** Medium
- **[Location]:** user_jobs.kanban_column, user_jobs.status, application_runs.status, etc.
- **[The Issue]:** Free-text columns accept any value; typo in service code corrupts DB; UI's expected enum values not enforced.
- **[The Fix/Implementation]:** `ALTER TABLE user_jobs ADD CONSTRAINT chk_kanban_column CHECK (kanban_column IN ('Discovered','Saved','Applied','Interview','Offer','Rejected'))`.

### 10.035 — No FOREIGN KEY ON UPDATE CASCADE — UUID changes silently break references
- **[Severity]:** Low
- **[Location]:** All FK declarations
- **[The Issue]:** UUIDs shouldn't change, but if backfills do anything weird, FK refs break; defensive ON UPDATE CASCADE is cheap.
- **[The Fix/Implementation]:** Add ON UPDATE CASCADE to every FK; document policy.

### 10.036 — Many migrations use `CREATE TABLE` (without IF NOT EXISTS) — Flyway repair needed if interrupted
- **[Severity]:** Low
- **[Location]:** V13, V15, V34 migrations
- **[The Issue]:** A failed migration mid-way leaves partial state; Flyway requires `flyway repair`; default Spring config doesn't enable.
- **[The Fix/Implementation]:** Add `spring.flyway.repair-on-migrate=false` (be deliberate); document repair procedure.

### 10.037 — db/networking.sql is a separate raw SQL file — purpose unclear
- **[Severity]:** Low
- **[Location]:** db/networking.sql
- **[The Issue]:** Likely seed data or alternate migration; not wired to Flyway; manual patch territory.
- **[The Fix/Implementation]:** Either fold into Flyway migrations or document as manual one-off (but discourage).

### 10.038 — Flyway migration filename `V_3.1__` (with underscore prefix) in db/migrations/ is non-canonical
- **[Severity]:** Low
- **[Location]:** db/migrations/V_3.1__*.sql
- **[The Issue]:** Flyway expects `V<version>__<desc>.sql`; underscore right after V is allowed but unusual; verify Flyway recognises.
- **[The Fix/Implementation]:** Rename to `V3.1__*.sql` or `V36__*.sql`; align with the `resources/db/migration/` convention.

### 10.039 — No migration covers Stripe customer/subscription tables despite billing routes
- **[Severity]:** Critical
- **[Location]:** Migrations folder + middleware/billing.routes.ts
- **[The Issue]:** Billing requires customers, subscriptions, invoices tables; nothing exists; backend has no Billing entity (Pass 9 #9.001); end-to-end billing impossible.
- **[The Fix/Implementation]:** Add migrations for `stripe_customers`, `stripe_subscriptions`, `stripe_invoices`; wire to entity + service + controller.

### 10.040 — No migration for password complexity / banned-passwords list
- **[Severity]:** Medium
- **[Location]:** Migrations
- **[The Issue]:** No `password_compromised` table tracking known-bad passwords; password complexity must be enforced in code only (5.007); rotation history not stored; users can reuse old password.
- **[The Fix/Implementation]:** Add `password_history(user_id, hash, set_at)` table; on reset, reject hashes matching last 5 entries.

### 10.041 — analytics_events index `idx_analytics_user_type_created` defined in entity but verify migration creates it
- **[Severity]:** Medium
- **[Location]:** AnalyticsEvent.java:19-22 vs V8__analytics_events.sql
- **[The Issue]:** Entity declares @Index but with `ddl-auto=validate`, Hibernate WON'T create indexes — only validate they exist; if migration omitted, queries slow.
- **[The Fix/Implementation]:** Audit V8; ensure CREATE INDEX matches entity declaration.

### 10.042 — schema.sql uses `EUR` currency default; entity also defaults `EUR`; hardcoded for Ireland
- **[Severity]:** Low
- **[Location]:** db/schema.sql:54, Job entity prePersist
- **[The Issue]:** SaaS expansion to non-EU markets requires per-market currency; default doesn't migrate.
- **[The Fix/Implementation]:** Use a `currencies` ref table; default per-user from profile.location.

### 10.043 — Flyway placeholder substitution not configured — no per-env values
- **[Severity]:** Low
- **[Location]:** application.properties
- **[The Issue]:** Some envs may need different seed data or configurations; placeholders provide injection.
- **[The Fix/Implementation]:** Configure `spring.flyway.placeholders.*` if needed.

### 10.044 — No migration adds soft-delete `deleted_at` to other entities (UserJob, Notification, Watchlist)
- **[Severity]:** Medium (per 4.056)
- **[Location]:** Migrations
- **[The Issue]:** Only User has soft-delete; rest are hard-deleted; auditability lost.
- **[The Fix/Implementation]:** Add `deleted_at` columns + partial indexes; update entities; @SQLRestriction filter.

### 10.045 — Migration sequence assumes ordered dependency but inserting V_3.1 / V9_1 makes ordering ambiguous
- **[Severity]:** Low
- **[Location]:** db/migrations/V_3.1, resources/db/migration/V9_1
- **[The Issue]:** Flyway sorts versions numerically; major.minor handled but underscore-style needs verification; alpha order may diverge.
- **[The Fix/Implementation]:** Stick to integer V1..V36 going forward; reserve fractional for hotfixes.

### 10.046 — schema.sql currency: Job stores `EUR` default; profile.salary_min/max have no currency
- **[Severity]:** Low
- **[Location]:** schema.sql user_profiles vs jobs
- **[The Issue]:** Profile salary defaults assumed EUR; cross-currency users mis-matched.
- **[The Fix/Implementation]:** Add `salary_currency TEXT DEFAULT 'EUR'` to user_profiles.

### 10.047 — db/networking.sql seed data may overwrite existing rows
- **[Severity]:** Low (pending verification)
- **[Location]:** db/networking.sql
- **[The Issue]:** If contains `INSERT` without `ON CONFLICT`, re-running corrupts.
- **[The Fix/Implementation]:** Audit; add `ON CONFLICT DO NOTHING` or move to Flyway.

### 10.048 — No migration enables `pg_stat_statements` for query performance auditing
- **[Severity]:** Enhancement
- **[Location]:** Migrations
- **[The Issue]:** Cannot identify slow queries in production; no SQL telemetry.
- **[The Fix/Implementation]:** `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` plus shared_preload_libraries config (Supabase manages).

### 10.049 — All migrations apply globally; no tenant isolation
- **[Severity]:** Enhancement
- **[Location]:** All migrations
- **[The Issue]:** Multi-tenant SaaS may want per-tenant schemas; current is single shared schema.
- **[The Fix/Implementation]:** Document as single-tenant; future-proof via `tenant_id` columns.

### 10.050 — No row-counts or sample data tests after migration
- **[Severity]:** Low
- **[Location]:** N/A
- **[The Issue]:** A migration that silently drops data leaves no canary.
- **[The Fix/Implementation]:** Add post-migration assertions: count of users > 0, etc.; run as part of CI integration test.

### 10.051 — V25 experiments table column `key` is a Postgres reserved-ish identifier
- **[Severity]:** Low
- **[Location]:** backend/src/main/resources/db/migration/V25__experiments.sql:5
- **[The Issue]:** While `key` is not a strict reserved word, it is a SQL keyword in some dialects and a frequent source of confusion; code that builds dynamic SQL without quoting may break on PG upgrade.
- **[The Fix/Implementation]:** Rename column to `flag_key` or `experiment_key`; update entity `@Column(name = "experiment_key")`.

### 10.052 — V25 onboarding_events.step is free VARCHAR; no CHECK constraint
- **[Severity]:** Medium
- **[Location]:** backend/src/main/resources/db/migration/V25__experiments.sql:31-34
- **[The Issue]:** OnboardingController accepts arbitrary `step` from request body (Pass 2 #2.029); no DB-level allowlist; corrupted analytics if frontend ships typo or attacker spams arbitrary step names.
- **[The Fix/Implementation]:** Add `CHECK (step IN ('profile_complete','first_skill_run','first_application',...))`; or move to `onboarding_step_types` ref table with FK.

### 10.053 — No explicit `CREATE SCHEMA IF NOT EXISTS career_operations` in any Flyway migration
- **[Severity]:** High
- **[Location]:** backend/src/main/resources/db/migration/V1__base_schema.sql (entire file)
- **[The Issue]:** Schema must already exist before Flyway runs; in a fresh Postgres without Supabase pre-creation, V1 runs in `public` (or fails on later `SET search_path`); deployment to non-Supabase Postgres breaks.
- **[The Fix/Implementation]:** Prepend `CREATE SCHEMA IF NOT EXISTS career_operations;` to V1 (or use a V0 baseline migration).

### 10.054 — V22 contact_interactions has `outcome` CHECK constraint that allows NULL
- **[Severity]:** Low
- **[Location]:** backend/src/main/resources/db/migration/V22__networking.sql:39-40
- **[The Issue]:** `outcome VARCHAR(30) CHECK (outcome IN (...))` — NULL passes any CHECK; analytics queries on outcome must always handle NULL; CRM dashboards skew.
- **[The Fix/Implementation]:** Either add `NOT NULL DEFAULT 'no_response'` or document NULL semantics in schema comment.

### 10.055 — V22 missing index on contact_interactions.user_id
- **[Severity]:** Medium
- **[Location]:** backend/src/main/resources/db/migration/V22__networking.sql:46-52
- **[The Issue]:** Indexes on contact_id + (user_id, next_step_due_date partial) but no plain user_id index; queries fetching all interactions for a user without due-date filter scan whole table.
- **[The Fix/Implementation]:** Add `CREATE INDEX idx_contact_interactions_user ON contact_interactions(user_id, created_at DESC)`.

### 10.056 — V22 network_contacts.email lacks unique constraint per user
- **[Severity]:** Low
- **[Location]:** backend/src/main/resources/db/migration/V22__networking.sql:9
- **[The Issue]:** Same email can be added twice to the same user's network; CSV import will produce duplicates silently (Pass 2 #2.024).
- **[The Fix/Implementation]:** `CREATE UNIQUE INDEX idx_network_contacts_user_email ON network_contacts(user_id, lower(email)) WHERE email IS NOT NULL`.

### 10.057 — Migration naming includes `phase4_batch1` etc. — internal sprint names leaked into permanent history
- **[Severity]:** Low
- **[Location]:** V26__phase4_batch1.sql … V32__phase4_gaps.sql
- **[The Issue]:** Future maintainers with no context for "phase4 batch1 outreach seeds" cannot reason about migration intent; bug reports referring to filenames are opaque.
- **[The Fix/Implementation]:** Rename to descriptive subjects (`V26__add_outreach_campaigns.sql`); for shipped migrations leave alone, but update the convention going forward.

### 10.058 — No migration defines text-search index on jobs.title/description
- **[Severity]:** Medium
- **[Location]:** db/schema.sql jobs table + migrations
- **[The Issue]:** JobsController.search filters in-memory (Pass 2 #2.016); a server-side ILIKE on description does sequential scan; no `tsvector` GIN index for full-text search.
- **[The Fix/Implementation]:** Add `ALTER TABLE jobs ADD COLUMN tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;` plus `CREATE INDEX idx_jobs_tsv ON jobs USING GIN (tsv);`.

### 10.059 — No `pg_trgm` extension for fuzzy company/title matching
- **[Severity]:** Low
- **[Location]:** Migrations
- **[The Issue]:** DeduplicationService likely benefits from fuzzy-match (typos in scraped data); `LIKE '%foo%'` without trigram index is slow.
- **[The Fix/Implementation]:** `CREATE EXTENSION IF NOT EXISTS pg_trgm;` plus GIN trigram indexes on jobs.company and jobs.title.

### 10.060 — Schema lacks per-table comments / documentation
- **[Severity]:** Low
- **[Location]:** All migrations
- **[The Issue]:** PostgreSQL `COMMENT ON TABLE` / `COMMENT ON COLUMN` empty; `\d+ tablename` in psql shows nothing useful; onboarding new engineers slower.
- **[The Fix/Implementation]:** `COMMENT ON TABLE user_jobs IS 'Per-user delivered job recommendations with match score and kanban state';` etc. for every domain table.

### 10.061 — No pgcrypto-based encryption-at-rest for sensitive columns (CV parsed_text, OTP hashes)
- **[Severity]:** Medium
- **[Location]:** db/schema.sql user_cvs.parsed_text, password_resets.otp_hash
- **[The Issue]:** Parsed CV text contains PII; database backup leak exposes everything cleartext; OTP hash already hashed but parsed_text not.
- **[The Fix/Implementation]:** Use `pgcrypto`'s `pgp_sym_encrypt(parsed_text, current_setting('app.encryption_key'))`; decrypt in service layer; keep encryption key in vault.

### 10.062 — Migrations lack rollback / down scripts
- **[Severity]:** Low
- **[Location]:** All V*.sql files
- **[The Issue]:** Flyway Community has no built-in rollback; if a deploy is bad, recovery requires manual reverse SQL; no documented rollback per migration.
- **[The Fix/Implementation]:** Maintain `U<N>__rollback_<desc>.sql` parallel files; document use; consider Flyway Teams (paid) for first-class undo.

### 10.063 — `seen_jobs` lacks index supporting fingerprint lookup at scale
- **[Severity]:** Medium
- **[Location]:** db/schema.sql:91-96
- **[The Issue]:** PRIMARY KEY (user_id, fingerprint) supports lookups by both, but DeduplicationService likely does `WHERE fingerprint = ? AND user_id IN (...)`; column ordering in PK affects which queries hit the index.
- **[The Fix/Implementation]:** Add `CREATE INDEX idx_seen_jobs_fingerprint ON seen_jobs(fingerprint)` if cross-user dedup is needed.

### 10.064 — daily_fetch_log uses DEFAULT CURRENT_DATE which Hibernate may bypass on insert
- **[Severity]:** Low
- **[Location]:** db/schema.sql:110-111
- **[The Issue]:** JPA insert with explicit `fetch_date = null` overrides default and inserts NULL, violating PRIMARY KEY constraint with confusing error.
- **[The Fix/Implementation]:** Mark column NOT NULL; use `@PrePersist` in entity to set default LocalDate.now().

### 10.065 — JSONB columns without size cap — pg row toast behaviour at 8KB
- **[Severity]:** Low
- **[Location]:** user_jobs.score_breakdown, audit_log.metadata, etc.
- **[The Issue]:** Unbounded JSONB stored TOASTed but each row capped at 1GB; if any entity stores huge payloads, slow reads; no schema-level validator.
- **[The Fix/Implementation]:** Add CHECK on length(metadata::text) < 65536; or split large payloads into sidecar tables.

### 10.066 — schema.sql `irish_companies` table not present in any Flyway migration
- **[Severity]:** Medium
- **[Location]:** db/schema.sql:140-185 vs Flyway migrations
- **[The Issue]:** Production via Flyway has no irish_companies table; JsoupCompanySource (Pass 3) tries to read from it and fails; feature broken unless schema.sql was manually run.
- **[The Fix/Implementation]:** Add a Flyway migration `V36__irish_companies.sql` that creates the table and seeds it; remove from schema.sql.

### 10.067 — V13 refresh_token VARCHAR(500) holds raw token; should hold hash only
- **[Severity]:** High
- **[Location]:** backend/src/main/resources/db/migration/V13__refresh_tokens.sql:5
- **[The Issue]:** Storing raw refresh token in DB means a leaked DB dump compromises every active session; standard practice is to hash it (sha256) and compare hashes server-side.
- **[The Fix/Implementation]:** Migrate to refresh_token_hash CHAR(64); on issuance hash the token before storing; on refresh, hash the incoming and compare.

### 10.068 — No migration adds index supporting password_resets.otp_hash + email lookup
- **[Severity]:** Low
- **[Location]:** db/schema.sql password_resets:130-137 (assuming Flyway equivalent)
- **[The Issue]:** Reset flow looks up by email + otp_hash; index only on PK id; sequential scan on password_resets table per reset attempt.
- **[The Fix/Implementation]:** `CREATE INDEX idx_password_resets_email_active ON password_resets(email) WHERE used = false`.

### 10.069 — V8 analytics_events lacks event_type CHECK / enum table
- **[Severity]:** Low
- **[Location]:** backend/src/main/resources/db/migration/V8__analytics_events.sql:7
- **[The Issue]:** Free VARCHAR(50) admits typos like "skil_run" vs "skill_run" indistinguishable; analytics queries silently undercount.
- **[The Fix/Implementation]:** Add `event_types` ref table; FK `event_type` to it; or strict CHECK.

### 10.070 — No migration enforces lowercase email at DB level
- **[Severity]:** Medium
- **[Location]:** V1__base_schema.sql users.email
- **[The Issue]:** UNIQUE on email allows "Foo@x.com" and "foo@x.com" as distinct rows; AuthService likely lowercases before insert but a raw SQL fix-up may bypass.
- **[The Fix/Implementation]:** `CREATE UNIQUE INDEX idx_users_email_lower ON users(lower(email));` and drop the original UNIQUE; service must use `WHERE lower(email) = lower(?)`.





















