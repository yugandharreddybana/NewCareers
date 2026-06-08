/**
 * api.ts — Axios instance, silent-refresh interceptor, and core API services.
 *
 * Pass 6 fixes folded in here:
 *   #6.017 / #6.026 — refresh path no longer duplicates `/api`; baseURL is
 *                    `<host>/api/v1` and the refresh helper uses a relative URL.
 *   #6.022 / #6.037 — env vars now come from `lib/env.ts`. Single source of
 *                    truth for VITE_API_URL (legacy VITE_MIDDLEWARE_URL still
 *                    honoured but deprecated).
 *   #6.023         — request URL rewriter scoped strictly to the legacy
 *                    `/api/` and `/api/v1/` prefixes; new code uses bare paths
 *                    like `/auth/login`.
 *   #6.024         — CSRF reads from the `co_csrf` cookie which is JS-readable
 *                    by contract (server.ts:108); broken if anyone makes it
 *                    HttpOnly.
 *   #6.025         — silent-refresh now uses a WeakSet keyed on the request
 *                    config so the retry flag cannot leak across React Query
 *                    invocations.
 *   #6.027         — on successful silent refresh we emit a `co:auth:refreshed`
 *                    custom event so AuthContext can re-fetch /auth/me.
 *   #8.010         — removed `.catch(() => mock)` fallbacks that masked
 *                    backend outages with fake data.
 *
 * F1 / F2 / F3 / F4 / G7 fixes preserved.
 */
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { redirectOnSessionExpired } from '@/lib/onboardingSession';
import { tokenStore } from '@/lib/tokenStore';
import { reportError } from '@/lib/telemetry';
import { API_V1_URL, DEV_BYPASS } from '@/lib/env';
import { isJwtExpired } from '@/lib/jwt';
import { endApiLoading, resetApiLoading, startApiLoading } from '@/lib/apiLoading';
import '@/lib/apiLoading';
import {
  emitPlanLimitExceeded,
  parsePlanLimitResponse,
} from '@/lib/planLimitEvents';
import type { PlanLimitPayload } from '@/lib/planLimitEvents';
import type { User, Profile, KanbanColumn, JobCard, JobDetail, JobsListResponse } from '@/types';
import { normalizeJobCard, normalizeJobDetail } from '@/lib/normalizeJobCard';

// ── Typed request bodies ────────────────────────────────────────────────────
interface SignupConsentsBody {
  termsAccepted: boolean;
  aiProcessingAccepted: boolean;
  marketingAccepted: boolean;
  analyticsAccepted: boolean;
}

interface SignupBody {
  name: string;
  username: string;
  email: string;
  password?: string;
  signupIntentId?: string;
  consents: SignupConsentsBody;
  emailVerificationId?: string;
}

interface SignupIntentBody {
  email: string;
  password: string;
  consents: SignupConsentsBody;
  name?: string;
  captchaToken?: string;
}

interface SignupIntentResponse {
  signupIntentId: string;
  expiresAt: string;
}

interface OnboardingOtpSentResponse {
  resendsRemaining: number;
  retryAfterSeconds: number;
}

interface OnboardingVerificationResponse {
  verificationId: string;
}

export interface OnboardingCvParseResponse {
  cvMarkdown: string;
  headline?: string;
  workExperience: Array<{
    jobTitle: string;
    companyName: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
    location?: string;
  }>;
  education: Array<{
    schoolName: string;
    degree: string;
    fieldOfStudy: string;
    graduationYear: string;
    location?: string;
  }>;
  projects?: Array<{
    title: string;
    description: string;
    url?: string;
    location?: string;
    techTags?: string[];
  }>;
  rolesFound: number;
  educationFound: number;
  projectsFound?: number;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
}
export interface WordCaptchaChallenge {
  challengeId: string;
  imageSvg: string;
}

interface LoginBody {
  email: string;
  password: string;
  rememberMe?: boolean;
  captchaToken?: string;
}
interface AuthResponse {
  user: User;
  token?: string;
  refreshToken?: string;
}

export type LoginFlowResponse =
  | { requiresTwoFactor: true; challengeToken: string }
  | { requiresTwoFactor?: false; user: User; token?: string; refreshToken?: string };
interface PublicStats {
  jobs: number;
  users: number;
  skills: number;
}

// ── Public events ──────────────────────────────────────────────────────────
export const AUTH_REFRESHED_EVENT = 'co:auth:refreshed';
export const AUTH_LOGGED_OUT_EVENT = 'co:auth:logged-out';

let csrfTokenMemory: string | null = null;
let csrfInitPromise: Promise<void> | null = null;

/** Read CSRF token from memory (prod) or co_csrf cookie (dev). */
function getCsrfToken(): string | null {
  if (csrfTokenMemory) return csrfTokenMemory;
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)co_csrf=([^;]+)/);
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

export async function initCsrfToken(): Promise<void> {
  if (DEV_BYPASS || typeof window === 'undefined') return;
  if (csrfInitPromise) return csrfInitPromise;
  csrfInitPromise = (async () => {
    try {
      const resp = await axios.get<{ token?: string }>(`${API_V1_URL}/csrf`, {
        withCredentials: true,
        timeout: 10_000,
      });
      const header = resp.headers['x-csrf-token'];
      csrfTokenMemory = resp.data?.token
        ?? (typeof header === 'string' ? header : null)
        ?? getCsrfToken();
    } catch {
      csrfTokenMemory = getCsrfToken();
    }
  })();
  return csrfInitPromise;
}

void initCsrfToken();

// ── Axios instance ─────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: API_V1_URL,
  withCredentials: true,
  timeout: 90_000,
});

// ── Request interceptor: bearer token + CSRF + path normalisation ─────────
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Pass 6 #6.023 — normalise legacy `/api/v1/...` and `/api/...` prefixes.
  // New code is expected to call `api.get('/auth/me')` directly.
  if (config.url?.startsWith('/api/v1/')) {
    config.url = config.url.replace(/^\/api\/v1\//, '/');
  } else if (config.url?.startsWith('/api/')) {
    config.url = config.url.replace(/^\/api\//, '/');
  }

  const token = tokenStore.getAccess();
  if (
    token &&
    !isJwtExpired(token) &&
    config.headers &&
    !isPublicAuthApiPath(config.url)
  ) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Custom header that browsers will not auto-attach cross-origin — this is
  // what middleware/rateLimiter.ts:csrfGuard checks for as defence-in-depth.
  if (config.headers) config.headers['X-Requested-With'] = 'XMLHttpRequest';

  // Double-submit CSRF for mutating verbs.
  if (config.method && MUTATING_METHODS.has(config.method.toLowerCase())) {
    const csrf = getCsrfToken();
    if (csrf && config.headers) {
      config.headers['X-CSRF-Token'] = csrf;
    }
  }

  startApiLoading(config);
  return config;
});

// ── Refresh-token machinery ────────────────────────────────────────────────
let refreshPromise: Promise<string> | null = null;

// Pass 6 #6.025 — replace the `_retry` flag-on-config with a WeakSet so each
// request is only ever retried once even when React Query retries it.
const retriedConfigs = new WeakSet<AxiosRequestConfig>();

function emit(eventName: string, detail?: unknown): void {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(eventName, { detail })); }
  catch { /* CustomEvent unavailable in some test envs */ }
}

const PUBLIC_PATHS_FRONTEND = new Set([
  '/',
  '/login',
  '/signup',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/get-started',
  '/onboarding',
  '/privacy',
  '/terms',
  '/help',
  '/accessibility',
]);

/** Pre-auth API routes — must not attach Bearer tokens or trigger silent refresh on 401. */
export const PUBLIC_AUTH_API_PATHS = new Set([
  '/auth/register',
  '/auth/signup',
  '/auth/signup-intent',
  '/auth/login',
  '/auth/google',
  '/auth/refresh',
  '/auth/logout',
  '/auth/captcha/challenge',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/onboarding/check-email',
  '/auth/onboarding/check-password',
  '/auth/onboarding/send-verification-otp',
  '/auth/onboarding/resend-verification-otp',
  '/auth/onboarding/verify-email',
  '/auth/onboarding/parse-cv',
]);

const PRE_AUTH_PAGES = new Set([
  '/signup',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

export function isPublicAuthApiPath(url: string | undefined): boolean {
  if (!url) return false;
  const normalized = url.startsWith('/api/v1/')
    ? url.replace(/^\/api\/v1\//, '/')
    : url.startsWith('/api/')
      ? url.replace(/^\/api\//, '/')
      : url;
  if (normalized.startsWith('/auth/signup-intent/') && normalized.endsWith('/exists')) {
    return true;
  }
  return PUBLIC_AUTH_API_PATHS.has(normalized);
}

/** Skip /auth/me probe on signup/login and deferred-signup onboarding when no session exists. */
export function shouldSkipInitialSessionProbe(): boolean {
  if (typeof window === 'undefined') return false;

  const access = tokenStore.getAccess();
  const hasValidAccess = Boolean(access && !isJwtExpired(access));
  if (hasValidAccess) return false;

  const path = window.location.pathname;
  if (PRE_AUTH_PAGES.has(path)) {
    return !tokenStore.hasRefreshOrCookie();
  }

  if (path === '/onboarding' && !tokenStore.hasRefreshOrCookie()) {
    return true;
  }

  return false;
}

/** Pure helper for redirect gating (deferred signup on /onboarding has no session). */
export function shouldRedirectOnAuthFailure(pathname: string, hasSession: boolean): boolean {
  if (pathname === '/onboarding' && !hasSession) return false;
  if (PUBLIC_PATHS_FRONTEND.has(pathname)) return false;
  return true;
}

/** Pure helper for jobs listAll pagination stop condition. */
export function shouldBreakJobPagination(hasMore: boolean, itemsLength: number): boolean {
  if (!hasMore) return true;
  if (itemsLength === 0) return true;
  return false;
}

interface ErrorBody {
  error?: string;
  message?: string;
  code?: string;
  captchaRequired?: boolean;
}

async function readErrorBody(err: AxiosError): Promise<ErrorBody> {
  const data = err.response?.data;
  if (data && typeof data === 'object' && !(data instanceof Blob)) {
    return data as ErrorBody;
  }
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      return JSON.parse(text) as ErrorBody;
    } catch {
      /* not JSON */
    }
  }
  return {};
}

/** Persist tokens after login / refresh — refresh lives in HttpOnly cookie only. */
function applyAuthResponse(data: AuthResponse): void {
  if (data.token) {
    tokenStore.setAccessOnly(data.token);
  }
}

async function postAuthRefresh(body: Record<string, unknown>): Promise<AuthResponse> {
  const csrf = getCsrfToken();
  const resp = await axios.post(`${API_V1_URL}/auth/refresh`, body, {
    withCredentials: true,
    timeout: 30_000,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
  });
  return resp.data as AuthResponse;
}

async function refreshAccessToken(): Promise<string> {
  if (!tokenStore.usesCookieRefresh()) {
    throw new Error('Your session expired. Please sign in again.');
  }
  const data = await postAuthRefresh({});
  applyAuthResponse(data);

  const access = data.token ?? tokenStore.getAccess();
  if (!access) {
    throw new Error('Your session expired. Please sign in again.');
  }
  emit(AUTH_REFRESHED_EVENT);
  return access;
}

/** Deduplicated silent refresh — shared by ensureFreshSession and the 401 interceptor. */
function getRefreshedAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .catch(err => {
        tokenStore.clear();
        emit(AUTH_LOGGED_OUT_EVENT);
        redirectOnAuthFailure();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Refresh the access token when it is missing or expired (e.g. before PDF export). */
export async function ensureFreshSession(): Promise<void> {
  if (DEV_BYPASS) return;

  const access = tokenStore.getAccess();
  if (access && !isJwtExpired(access)) return;

  await getRefreshedAccessToken();
}

function redirectOnAuthFailure(): void {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname;
  if (!shouldRedirectOnAuthFailure(here, tokenStore.hasRefreshOrCookie())) return;
  redirectOnSessionExpired(here);
}

// ── Response interceptor: 401 → silent refresh, 429 → toast, others → normalise ──
api.interceptors.response.use(
  (response) => {
    endApiLoading(response.config as InternalAxiosRequestConfig);
    return response;
  },
  async (err: AxiosError<{ error?: string; message?: string }>) => {
    const originalRequest = err.config as InternalAxiosRequestConfig | undefined;

    if (err.code === 'ERR_CANCELED') {
      endApiLoading(originalRequest);
      return Promise.reject(err);
    }

    const isRefreshableRequest =
      originalRequest &&
      err.response?.status === 401 &&
      !retriedConfigs.has(originalRequest) &&
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/login' &&
      !isPublicAuthApiPath(originalRequest.url);

    // 429 → user-facing toast
    if (err.response?.status === 429) {
      endApiLoading(originalRequest);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Too many requests — please slow down.';
      const retryHeader = err.response?.headers?.['retry-after'];
      const retryAfterSeconds = typeof retryHeader === 'string'
        ? Number.parseInt(retryHeader, 10)
        : undefined;
      const enriched429 = err as AxiosError & {
        normalizedMessage: string;
        status?: number;
        retryAfterSeconds?: number;
      };
      enriched429.normalizedMessage = msg;
      enriched429.status = 429;
      if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        enriched429.retryAfterSeconds = retryAfterSeconds;
      }
      if (!originalRequest?.skipGlobalLoader) {
        toast.error(msg, { id: 'rate-limit', duration: 4000 });
      }
      return Promise.reject(enriched429);
    }

    // 402 → plan limit banner (no toast)
    if (err.response?.status === 402) {
      endApiLoading(originalRequest);
      const errorBody = await readErrorBody(err);
      const planLimit = parsePlanLimitResponse(errorBody as Record<string, unknown>);
      if (planLimit) {
        emitPlanLimitExceeded(planLimit);
      }
      const enriched402 = err as AxiosError & { normalizedMessage: string; planLimit?: PlanLimitPayload | null };
      enriched402.normalizedMessage =
        (errorBody as { error?: string }).error ?? 'Plan limit exceeded';
      if (planLimit) {
        enriched402.planLimit = planLimit;
      }
      return Promise.reject(enriched402);
    }

  if (isRefreshableRequest) {
      retriedConfigs.add(originalRequest);
      // Release the original request's loader before retry — otherwise the retry
      // opens a second track and the first id never clears (infinite overlay).
      endApiLoading(originalRequest);

      try {
        const access = await getRefreshedAccessToken();

        if (originalRequest.headers) {
          const headers = originalRequest.headers as Record<string, string>;
          if (access) headers['Authorization'] = `Bearer ${access}`;
          else delete headers['Authorization'];
        }
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    endApiLoading(originalRequest);

    // For any other error, attach a normalised message + report 5xx to telemetry.
    const errorBody = await readErrorBody(err);
    const normalized = errorBody.error ?? errorBody.message ?? err.message ?? 'Request failed';
    const enriched = err as AxiosError & { normalizedMessage: string; captchaRequired?: boolean };
    enriched.normalizedMessage = normalized;
    if (errorBody.captchaRequired) enriched.captchaRequired = true;

    const isCorsFailure = normalized.includes('CORS:') || err.code === 'ERR_NETWORK';
    if (err.response && err.response.status >= 500 && !isCorsFailure) {
      reportError({
        message: `[axios ${err.response.status}] ${normalized}`,
        source: 'axios',
        context: { url: originalRequest?.url, method: originalRequest?.method },
      });
    }
    return Promise.reject(err);
  },
);

// ── Public API ─────────────────────────────────────────────────────────────
export const publicApi = {
  /** Pass 6 #6.016 — real social-proof numbers for the Login page. */
  stats: (): Promise<PublicStats> =>
    api.get<PublicStats>('/public/stats').then(r => r.data),
};

// ── Auth API ──────────────────────────────────────────────────────────────
export const authApi = {
  createSignupIntent: (b: SignupIntentBody): Promise<SignupIntentResponse> =>
    api
      .post<SignupIntentResponse>('/auth/signup-intent', b, { skipGlobalLoader: true })
      .then(r => r.data),

  signup: async (b: SignupBody): Promise<AuthResponse> => {
    const r = await api.post<AuthResponse>('/auth/register', b);
    applyAuthResponse(r.data);
    return r.data;
  },

  getWordCaptchaChallenge: (): Promise<WordCaptchaChallenge> =>
    api
      .get<WordCaptchaChallenge>('/auth/captcha/challenge', { skipGlobalLoader: true })
      .then(r => r.data),

  login: async (b: LoginBody): Promise<LoginFlowResponse> => {
    const r = await api.post<LoginFlowResponse>('/auth/login', b, { skipGlobalLoader: true });
    if (r.data.requiresTwoFactor) {
      return r.data;
    }
    applyAuthResponse(r.data);
    return r.data;
  },

  verifyTwoFactor: async (challengeToken: string, code: string): Promise<AuthResponse> => {
    const r = await api.post<AuthResponse>(
      '/auth/two-factor/verify',
      { challengeToken, code },
      { skipGlobalLoader: true },
    );
    applyAuthResponse(r.data);
    return r.data;
  },

  google: async (
    idToken: string,
    rememberMe?: boolean,
    consents?: SignupConsentsBody,
    captchaToken?: string,
  ): Promise<AuthResponse> => {
    const r = await api.post<AuthResponse>(
      '/auth/google',
      {
        idToken,
        rememberMe: Boolean(rememberMe),
        consents,
        ...(captchaToken ? { captchaToken } : {}),
      },
      { skipGlobalLoader: true },
    );
    applyAuthResponse(r.data);
    return r.data;
  },

  confirmGoogleLink: async (
    idToken: string,
    password: string,
    rememberMe?: boolean,
    captchaToken?: string,
  ): Promise<AuthResponse> => {
    const r = await api.post<AuthResponse>(
      '/auth/google/link/confirm',
      {
        idToken,
        password,
        rememberMe: Boolean(rememberMe),
        ...(captchaToken ? { captchaToken } : {}),
      },
      { skipGlobalLoader: true },
    );
    applyAuthResponse(r.data);
    return r.data;
  },

  logout: async (): Promise<{ success: boolean }> => {
    try { await api.post('/auth/logout'); }
    finally { tokenStore.clear(); emit(AUTH_LOGGED_OUT_EVENT); }
    return { success: true };
  },

  refresh: async (): Promise<AuthResponse> => {
    const data = await postAuthRefresh({});
    applyAuthResponse(data);
    if (data.token) emit(AUTH_REFRESHED_EVENT);
    return data;
  },

  me: (): Promise<User> => api.get<User>('/auth/me').then(r => r.data),

  forgotPassword: (email: string): Promise<void> =>
    api
      .post<void>('/auth/forgot-password', { email }, { skipGlobalLoader: true })
      .then(r => r.data),

  resetPassword: (b: {
    email: string;
    otp: string;
    newPassword: string;
    accessToken?: string;
  }): Promise<void> =>
    api
      .post<void>('/auth/reset-password', b, { skipGlobalLoader: true })
      .then(r => r.data),

  /** @deprecated Prefer createSignupIntent; check-email always returns { available: true } for anti-enumeration. */
  checkSignupEmail: (email: string): Promise<{ available: boolean }> =>
    api
      .post<{ available: boolean }>('/auth/onboarding/check-email', { email }, { skipGlobalLoader: true })
      .then(r => r.data),

  sendOnboardingVerificationOtp: (b: {
    email: string;
    firstName?: string;
    captchaToken?: string;
  }): Promise<OnboardingOtpSentResponse> =>
    api
      .post<OnboardingOtpSentResponse>('/auth/onboarding/send-verification-otp', b, { skipGlobalLoader: true })
      .then(r => r.data),

  resendOnboardingVerificationOtp: (
    email: string,
    captchaToken?: string,
  ): Promise<OnboardingOtpSentResponse> =>
    api
      .post<OnboardingOtpSentResponse>(
        '/auth/onboarding/resend-verification-otp',
        { email, ...(captchaToken ? { captchaToken } : {}) },
        { skipGlobalLoader: true },
      )
      .then(r => r.data),

  verifyOnboardingEmail: (b: {
    email: string;
    otp: string;
    captchaToken?: string;
  }): Promise<OnboardingVerificationResponse> =>
    api
      .post<OnboardingVerificationResponse>('/auth/onboarding/verify-email', b, { skipGlobalLoader: true })
      .then(r => r.data),

  parseOnboardingCv: (
    file: File,
    signupIntentId?: string,
    email?: string,
    captchaToken?: string,
  ): Promise<OnboardingCvParseResponse> => {
    const fd = new FormData();
    fd.append('file', file);
    if (signupIntentId) fd.append('signupIntentId', signupIntentId);
    if (email) fd.append('email', email);
    if (captchaToken) fd.append('captchaToken', captchaToken);
    return api
      .post<OnboardingCvParseResponse>('/auth/onboarding/parse-cv', fd, { skipGlobalLoader: true })
      .then(r => r.data);
  },
};

// ── Profile API ───────────────────────────────────────────────────────────
export const profileApi = {
  get: (): Promise<Profile> => api.get<Profile>('/profile').then(r => r.data),
  update: (b: object) => api.put<Profile>('/profile', b).then(r => r.data),
  uploadCv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<{ id: string; fileName: string; uploadedAt?: string }>('/profile/cv', fd)
      .then(r => r.data);
  },
  cvDownload: () => api.get<{ url: string }>('/profile/cv/download').then(r => r.data),
  /** Opens signed Supabase URL or fetches local-dev CV bytes with auth. */
  openCvDownload: async (url: string, fileName?: string | null): Promise<void> => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const path = url.startsWith('/api/v1') ? url.slice('/api/v1'.length) : url;
    const res = await api.get(path, { responseType: 'blob' });
    const blob = res.data as Blob;
    const objectUrl = URL.createObjectURL(blob);
    const w = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (!w) {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName?.trim() || 'cv.pdf';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    scheduleRevokeObjectUrl(objectUrl, w);
  },
  stats: () => api.get('/profile/stats').then(r => r.data),
  addPortfolioItem: (body: {
    title: string;
    url?: string;
    description?: string;
    techTags?: string[];
    location?: string;
  }) =>
    api.post('/profile/portfolio', body).then(r => r.data),
  updatePortfolioItem: (itemId: string, body: { title: string; url?: string; description?: string; techTags?: string[] }) =>
    api.put(`/profile/portfolio/${itemId}`, body).then(r => r.data),
  deletePortfolioItem: (itemId: string) =>
    api.delete(`/profile/portfolio/${itemId}`).then(r => r.data),
  importLinkedIn: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/profile/import/linkedin', fd, { timeout: 60_000 }).then(r => r.data);
  },
};

// ── Onboarding delivery (Track A) ─────────────────────────────────────────
export type OnboardingDeliveryStatus = {
  stage: string;
  message: string;
  evaluatedCount: number;
  targetCount: number;
  minRequired: number;
  jobsDiscovered: number;
  readyPartial: boolean;
  ready: boolean;
  error?: string | null;
};

export const onboardingApi = {
  startDelivery: (restart = false): Promise<{ stage: string; message: string }> =>
    api
      .post('/onboarding/delivery/start', null, { params: restart ? { restart: true } : undefined })
      .then(r => r.data),
  deliveryStatus: (): Promise<OnboardingDeliveryStatus> =>
    api.get<OnboardingDeliveryStatus>('/onboarding/delivery/status').then(r => r.data),
};

// ── CV download blob URL cleanup ───────────────────────────────────────────
let cvDownloadRevokeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRevokeObjectUrl(objectUrl: string, popup: Window | null): void {
  if (cvDownloadRevokeTimer) {
    clearTimeout(cvDownloadRevokeTimer);
    cvDownloadRevokeTimer = null;
  }
  const revoke = () => {
    URL.revokeObjectURL(objectUrl);
    if (cvDownloadRevokeTimer) {
      clearTimeout(cvDownloadRevokeTimer);
      cvDownloadRevokeTimer = null;
    }
  };
  if (popup) {
    try {
      popup.addEventListener('load', revoke, { once: true });
    } catch {
      /* cross-origin popup — fall back to timeout only */
    }
    cvDownloadRevokeTimer = setTimeout(revoke, 5_000);
  } else {
    revoke();
  }
}

// ── Jobs API ──────────────────────────────────────────────────────────────
const JOBS_PAGE_SIZE = 200;

export const jobsApi = {
  list: (page = 0, size = JOBS_PAGE_SIZE) =>
    api
      .get<JobsListResponse>('/jobs', { params: { page, size } })
      .then(r => ({
        ...r.data,
        items: (r.data.items ?? []).map((item: JobCard) => normalizeJobCard(item)),
      })),
  /** Fetches every job in the user's pipeline (paginates until exhausted). */
  listAll: async (): Promise<JobsListResponse> => {
    const allItems: JobCard[] = [];
    let page = 0;
    let meta: JobsListResponse = {
      items: [],
      dailyCount: 0,
      dailyLimit: 25,
      remaining: 0,
      totalCount: 0,
      page: 0,
      size: JOBS_PAGE_SIZE,
      hasMore: false,
    };
    for (let guard = 0; guard < 20; guard++) {
      const batch = await jobsApi.list(page, JOBS_PAGE_SIZE);
      meta = batch;
      allItems.push(...batch.items);
      if (shouldBreakJobPagination(batch.hasMore ?? false, batch.items.length)) break;
      page += 1;
    }
    return {
      ...meta,
      items: allItems,
      totalCount: meta.totalCount ?? allItems.length,
      hasMore: false,
    };
  },
  detail: (userJobId: string) =>
    api
      .get<JobDetail>(`/jobs/${userJobId}`, { timeout: 45_000 })
      .then(r => normalizeJobDetail(r.data)),
  /** Recompute CV↔posting skill match for every pipeline job (persists to DB). */
  refreshSkills: () =>
    api.post<JobsListResponse>('/jobs/refresh-skills', null, {
      timeout: 120_000,
      skipGlobalLoader: true,
    }),
  enrichDescription: (userJobId: string) =>
    api
      .post<JobDetail>(`/jobs/${userJobId}/description`, null, {
        timeout: 45_000,
        loaderMessage: 'Loading job description…',
      })
      .then(r => normalizeJobDetail(r.data)),
  fetch: (count = 5) =>
    api
      .post('/jobs/fetch', null, {
        params: { count },
        timeout: 180_000,
        loaderMessage: 'Scanning IrishJobs, Jobs.ie, LinkedIn, Remotive, and more…',
      })
      .then(r => r.data),
  fetchIrishJobs: (count = 10) =>
    api
      .post('/jobs/fetch-irishjobs', null, {
        params: { count },
        timeout: 120_000,
        loaderMessage: 'Finding Irish roles that match your profile…',
      })
      .then(r => r.data),
  /** One live job from all sources (Adzuna → Indeed fallback), profile-ranked */
  fetchLive: () =>
    api
      .post<import('@/types').JobCard>('/jobs/fetch-live', null, {
        timeout: 60_000,
        loaderMessage: 'Finding jobs that match your profile…',
      })
      .then(r => normalizeJobCard(r.data)),
  /** @deprecated use fetchLive instead */
  fetchAdzunaLive: () =>
    api.post<import('@/types').JobCard>('/jobs/fetch-adzuna-live', null, { timeout: 60_000 }).then(r => r.data),
  /** @deprecated use fetchLive instead */
  fetchIndeedLive: () =>
    api.post<import('@/types').JobCard>('/jobs/fetch-indeed-live', null, { timeout: 60_000 }).then(r => r.data),
  delete: (userJobId: string) =>
    api.delete(`/jobs/${userJobId}`).then(() => undefined),
  /** Soft-delete every job in the user's pipeline. */
  clearPipeline: () =>
    api.delete('/jobs/pipeline').then(() => undefined),
  recommended: () => api.get('/jobs/recommended').then(r => r.data),
  limits: () => api.get('/jobs/limits').then(r => r.data),
  stats: () => api.get('/jobs/stats').then(r => r.data),
};

export const usageApi = {
  limits: () => api.get<import('@/types').UsageLimits>('/usage/limits').then(r => r.data),
};

// ── Kanban API ────────────────────────────────────────────────────────────
export const kanbanApi = {
  patch: (id: string, body: { kanbanColumn?: KanbanColumn; status?: string }) =>
    api.patch(`/kanban/${id}`, body).then(r => r.data),
  uploadCv: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/kanban/${id}/cv`, fd).then(r => r.data);
  },
};

// Pass 6 #6.012 — canonical SkillStartRequest / SkillRunResponse and
// the `skillsApi` client live in `services/skillsApi.ts`.

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_LOGGED_OUT_EVENT, () => resetApiLoading());
}
