/**
 * env.ts — single source of truth for environment-derived flags.
 */
const env = import.meta.env;

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

export const IS_PROD: boolean = env.MODE === 'production';
export const IS_DEV: boolean = env.MODE === 'development' || env.DEV === true;

/** Only honoured in development builds when explicitly opted in. */
export const DEV_BYPASS: boolean =
  IS_DEV && !IS_PROD && env.VITE_DEV_BYPASS_GUARDS === 'true';

/** Matches local middleware when set explicitly in .env (bypasses Vite proxy). */
const LOCAL_MIDDLEWARE_RE = /^https?:\/\/(localhost|127\.0\.0\.1):4000$/i;

function resolveApiBaseUrl(): string {
  const configured = stripTrailingSlash(
    String(env.VITE_API_URL ?? env.VITE_MIDDLEWARE_URL ?? '').trim(),
  );
  if (!configured) return '';
  // In dev, `http://localhost:4000` in .env causes cross-origin calls and
  // ERR_CONNECTION_REFUSED when only `vite` is running. Same-origin `/api`
  // is proxied to :4000 by vite.config.ts.
  if (IS_DEV && LOCAL_MIDDLEWARE_RE.test(configured)) return '';
  return configured;
}

/** Middleware base URL (empty in dev → same-origin Vite `/api` proxy). */
export const API_BASE_URL: string = resolveApiBaseUrl();

/** Versioned API root — relative `/api/v1` in dev, absolute URL in prod. */
export const API_V1_URL: string = API_BASE_URL
  ? `${API_BASE_URL}/api/v1`
  : '/api/v1';

/** Optional Sentry DSN — when present, error boundary auto-reports. */
export const SENTRY_DSN: string | undefined = env.VITE_SENTRY_DSN;

/** Google OAuth 2.0 Web client ID (same value as GOOGLE_OAUTH_CLIENT_ID on Java). */
export const GOOGLE_CLIENT_ID: string = String(env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

export const GOOGLE_AUTH_ENABLED: boolean = GOOGLE_CLIENT_ID.length > 0;

/** Google reCAPTCHA v2 site key (pairs with captcha.secret on Java). */
export const RECAPTCHA_SITE_KEY: string = String(env.VITE_RECAPTCHA_SITE_KEY ?? '').trim();

export const CAPTCHA_ENABLED: boolean = RECAPTCHA_SITE_KEY.length > 0;

/**
 * Login jumbled-word CAPTCHA — on in production builds; off in dev unless
 * VITE_LOGIN_CAPTCHA_REQUIRED=true (pairs with auth.login.word-captcha.required on Java).
 */
export const LOGIN_WORD_CAPTCHA_REQUIRED: boolean =
  IS_PROD || env.VITE_LOGIN_CAPTCHA_REQUIRED === 'true';
