/**
 * env.ts — single source of truth for environment-derived flags.
 *
 * Pass 6 fixes 6.003, 6.004, 6.022, 6.037, 6.042 all converged here so that
 * every consumer (AuthContext, ProtectedRoute, Login, api.ts, etc.) reads
 * the same values from one place.
 *
 * Conventions:
 *   - IS_PROD       — strict production build (Vite `MODE === 'production'`).
 *   - IS_DEV        — local Vite dev mode.
 *   - DEV_BYPASS    — only true when explicitly opted-in via env var AND not
 *                     production. Used to short-circuit auth guards locally.
 *   - USE_MOCKS     — fully mocked data path (no network).
 *   - API_BASE_URL  — middleware base URL. Defaults to same-origin so Vite's
 *                     dev proxy can avoid CORS in local development.
 *
 * Notes for future maintainers:
 *   - `import.meta.env.DEV` flips to `true` automatically under `vite dev` /
 *     `vite preview`. We INTENTIONALLY do NOT enable DEV_BYPASS from `DEV`
 *     alone — a `vite preview` of a public build would otherwise bypass auth.
 *   - Variable name canonicalised to `VITE_API_URL` (matches `.env.example`).
 *     The legacy `VITE_MIDDLEWARE_URL` is still honoured so existing local
 *     `.env` files do not silently break.
 */

const env = import.meta.env;

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

export const IS_PROD: boolean = env.MODE === 'production';
export const IS_DEV: boolean = env.MODE === 'development' || env.DEV === true;

export const USE_MOCKS: boolean = env.VITE_USE_MOCKS === 'true';

/** Only honoured when explicitly opted in AND we're not in production. */
export const DEV_BYPASS: boolean =
  !IS_PROD && env.VITE_DEV_BYPASS_GUARDS === 'true';

const defaultApiBaseUrl = IS_DEV ? '' : '';

/** Middleware base URL (without `/api` suffix; api.ts appends versioning). */
export const API_BASE_URL: string = stripTrailingSlash(
  env.VITE_API_URL ?? env.VITE_MIDDLEWARE_URL ?? defaultApiBaseUrl,
);

/** Versioned API root, e.g. `http://localhost:4000/api/v1`. */
export const API_V1_URL: string = `${API_BASE_URL}/api/v1`;

/** Optional Sentry DSN — when present, error boundary auto-reports. */
export const SENTRY_DSN: string | undefined = env.VITE_SENTRY_DSN;
