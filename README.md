# CareerOps — AI-Powered Career Intelligence Platform

A full-stack job search acceleration platform with AI skill execution, automated job discovery, Kanban pipeline management, outreach generation, and interview coaching.

## Architecture

```
browser (React + Vite)
    ↓ HTTPS
Node.js Middleware (Express) — auth, rate limiting, CORS, input sanitisation
    ↓ internal HTTP
Java Spring Boot Backend — business logic, AI skill execution, data persistence
    ↓
PostgreSQL / Redis
```

## Quick Start

### Prerequisites
- Node.js 20+
- Java 21+
- PostgreSQL 15+
- Redis (optional — for distributed rate limiting)

### 1. Frontend
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: set VITE_API_URL=http://localhost:4000
npm install
npm run dev
```

### 2. Middleware
```bash
cd middleware
cp .env.example .env
# Edit .env: set JWT_PUBLIC_KEY, INTERNAL_TRUST_SECRET, JAVA_BACKEND_URL,
# and the required Stripe keys
npm install
npm run dev
```

### 3. Java Backend
```bash
cd backend
# Copy src/main/resources/application.example.properties to application.properties
# Set spring.datasource.*, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY,
# and INTERNAL_TRUST_SECRET
mvn spring-boot:run
```

## Key Environment Variables

| Variable | Where | Required | Description |
|---|---|---|---|
| `VITE_API_URL` | frontend | ✅ | Node middleware base URL |
| `JWT_PUBLIC_KEY` | middleware | ✅ | Base64 SPKI public key used to verify Java RS256 session tokens |
| `JWT_PRIVATE_KEY` | backend | ✅ | Base64 PKCS#8 private key used by Java to issue RS256 session tokens |
| `JAVA_BACKEND_URL` | middleware | ✅ | Java backend internal URL |
| `ALLOWED_ORIGINS` | middleware | ✅ | Comma-separated allowed CORS origins |
| `REDIS_URL` | middleware | ❌ | Redis for distributed rate limiting |
| `VITE_DEV_BYPASS_GUARDS` | frontend | ❌ | Dev-only auth bypass (never in prod) |

## Project Structure

```
frontend/          React + Vite + TypeScript
  src/
    pages/         Route-level components (lazy-loaded)
    components/    Shared UI components
    context/       React contexts (AuthContext, ExperimentContext)
    services/      API service modules + barrel index
    hooks/         Custom hooks (useAsync, ...)
    types/         Shared TypeScript domain types
    lib/           Utilities (tokenStore, ...)
middleware/        Node.js + Express + TypeScript
  src/
    routes/        Per-domain route files
    authGuard.ts   JWT verification middleware
    rateLimiter.ts Express rate limiters (RedisStore aware)
    sanitize.ts    Input sanitisation (trimStrings, stripXss)
backend/           Java Spring Boot
```

## Batch Fix Log

All code quality fixes applied in structured batches:

| Batch | Scope | Fixes |
|---|---|---|
| Batch 1 | Security & Auth | XSS token risk, DEV_BYPASS prod guard, CSRF, Redis rate limiter, reset-password 422 |
| Batch 2 | Frontend Architecture | Axios instance fix, auth loading flash, ErrorBoundary, useAsync hook, services barrel |
| Batch 3 | Middleware Architecture | Multi-origin CORS, env startup validation, per-user rate limit, compression, stripXss, skillLimiter |
| Batch 4 | Types & Contracts | User type expansion, KanbanColumn union, ApiError type, shared domain type files |
| Batch 5 | DX & Config | Vite chunk splitting, .env.example audit, tsconfig strict+, README |
| Batch 6 | Code Quality | `any` elimination, error handling, dead code removal |

## Database Schema & Migrations

All database schema migrations are managed via Flyway under `backend/src/main/resources/db/migration`. 
To prevent version collisions and guarantee reliable, automated schema updates:
1. **Flyway Migration Naming**: Ensure every migration follows the pattern `V<N>__<description>.sql`, where `<N>` is a unique version number (e.g., `V9` or `V9_1` which is parsed as 9.1).
2. **No Duplicates**: Never reuse version numbers or create duplicate major versions (like two `V9__*` files).
3. **Under-score Minor Versioning**: Minor versions should use underscores (e.g., `V9_1`) instead of decimals for cross-OS compatibility.
4. **Automated Migration**: Do not run raw SQL scripts directly in the database; always deploy schema changes via `mvn flyway:migrate`.
