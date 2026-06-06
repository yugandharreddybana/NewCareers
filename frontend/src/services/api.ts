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
import { endApiLoading, startApiLoading } from '@/lib/apiLoading';
import '@/lib/apiLoading';
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
  password: string;
  consents: SignupConsentsBody;
  emailVerificationId?: string;
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
  }>;
  education: Array<{
    schoolName: string;
    degree: string;
    fieldOfStudy: string;
    graduationYear: string;
  }>;
  projects?: Array<{
    title: string;
    description: string;
  }>;
  rolesFound: number;
  educationFound: number;
  projectsFound?: number;
}
export interface WordCaptchaLetter {
  character: string;
  rotate: number;
  translateY: number;
  color: string;
}

export interface WordCaptchaChallenge {
  challengeId: string;
  letters: WordCaptchaLetter[];
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
interface PublicStats {
  jobs: number;
  users: number;
  skills: number;
}

// ── Public events ──────────────────────────────────────────────────────────
export const AUTH_REFRESHED_EVENT = 'co:auth:refreshed';
export const AUTH_LOGGED_OUT_EVENT = 'co:auth:logged-out';

/** Read the co_csrf cookie that the middleware sets on first response. */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)co_csrf=([^;]+)/);
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

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
let isRefreshing = false;
type FailedQueueItem = { resolve: (token: string) => void; reject: (reason?: unknown) => void };
let failedQueue: FailedQueueItem[] = [];

// Pass 6 #6.025 — replace the `_retry` flag-on-config with a WeakSet so each
// request is only ever retried once even when React Query retries it.
const retriedConfigs = new WeakSet<AxiosRequestConfig>();

function processQueue(error: unknown, token: string | null = null) {
  for (const { resolve, reject } of failedQueue) {
    if (error || token === null) reject(error);
    else                         resolve(token);
  }
  failedQueue = [];
}

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
  '/auth/login',
  '/auth/captcha/challenge',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/onboarding/check-email',
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

interface ErrorBody {
  error?: string;
  message?: string;
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

/** Persist tokens after login / refresh — refresh may live in HttpOnly cookie. */
function applyAuthResponse(data: AuthResponse, rememberMe?: boolean): void {
  if (data.token && data.refreshToken) {
    tokenStore.set(data.token, data.refreshToken);
    return;
  }
  if (data.token) {
    tokenStore.setAccessOnly(data.token);
    if (rememberMe) tokenStore.setRefreshViaCookie(true);
    return;
  }
  if (data.refreshToken) tokenStore.setRefresh(data.refreshToken);
}

async function refreshAccessToken(): Promise<string> {
  const sessionRefresh = tokenStore.getRefresh();
  if (!sessionRefresh && !tokenStore.usesCookieRefresh()) {
    throw new Error('Your session expired. Please sign in again.');
  }
  const resp = await axios.post(
    `${API_V1_URL}/auth/refresh`,
    sessionRefresh ? { refreshToken: sessionRefresh } : {},
    {
      withCredentials: true,
      timeout: 30_000,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
      },
    },
  );

  const data = resp.data as AuthResponse;
  const rememberViaCookie = !data.refreshToken && Boolean(data.token);
  applyAuthResponse(data, rememberViaCookie);

  const access = data.token ?? tokenStore.getAccess();
  if (!access) {
    throw new Error('Your session expired. Please sign in again.');
  }
  emit(AUTH_REFRESHED_EVENT);
  return access;
}

/** Refresh the access token when it is missing or expired (e.g. before PDF export). */
export async function ensureFreshSession(): Promise<void> {
  if (DEV_BYPASS) return;

  const access = tokenStore.getAccess();
  if (access && !isJwtExpired(access)) return;

  if (isRefreshing) {
    return new Promise<void>((resolve, reject) => {
      failedQueue.push({
        resolve: () => resolve(),
        reject,
      });
    });
  }

  isRefreshing = true;
  try {
    await refreshAccessToken();
    processQueue(null, tokenStore.getAccess());
  } catch (error) {
    processQueue(error, null);
    tokenStore.clear();
    emit(AUTH_LOGGED_OUT_EVENT);
    redirectOnAuthFailure();
    throw error;
  } finally {
    isRefreshing = false;
  }
}

function redirectOnAuthFailure(): void {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname;
  if (PUBLIC_PATHS_FRONTEND.has(here) && here !== '/onboarding') return;
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
        retryAfterSeconds?: number;
      };
      enriched429.normalizedMessage = msg;
      if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        enriched429.retryAfterSeconds = retryAfterSeconds;
      }
      if (!originalRequest?.skipGlobalLoader) {
        toast.error(msg, { id: 'rate-limit', duration: 4000 });
      }
      return Promise.reject(enriched429);
    }

  if (isRefreshableRequest) {
      retriedConfigs.add(originalRequest);
      // Release the original request's loader before retry — otherwise the retry
      // opens a second track and the first id never clears (infinite overlay).
      endApiLoading(originalRequest);

      try {
        const access = await (async () => {
          if (isRefreshing) {
            return new Promise<string>((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            });
          }
          isRefreshing = true;
          try {
            const token = await refreshAccessToken();
            processQueue(null, token);
            return token;
          } catch (refreshError) {
            processQueue(refreshError, null);
            tokenStore.clear();
            emit(AUTH_LOGGED_OUT_EVENT);
            redirectOnAuthFailure();
            throw refreshError;
          } finally {
            isRefreshing = false;
          }
        })();

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
  signup: async (b: SignupBody): Promise<AuthResponse> => {
    const r = await api.post<AuthResponse>('/auth/signup', b);
    if (r.data.token)        tokenStore.setAccess(r.data.token);
    if (r.data.refreshToken) tokenStore.setRefresh(r.data.refreshToken);
    return r.data;
  },

  getWordCaptchaChallenge: (): Promise<WordCaptchaChallenge> =>
    api
      .get<WordCaptchaChallenge>('/auth/captcha/challenge', { skipGlobalLoader: true })
      .then(r => r.data),

  login: async (b: LoginBody): Promise<AuthResponse> => {
    const r = await api.post<AuthResponse>('/auth/login', b, { skipGlobalLoader: true });
    applyAuthResponse(r.data, b.rememberMe);
    return r.data;
  },

  google: async (
    idToken: string,
    rememberMe?: boolean,
    consents?: SignupConsentsBody,
  ): Promise<AuthResponse> => {
    const r = await api.post<AuthResponse>(
      '/auth/google',
      { idToken, rememberMe: Boolean(rememberMe), consents },
      { skipGlobalLoader: true },
    );
    applyAuthResponse(r.data, rememberMe);
    return r.data;
  },

  logout: async (): Promise<{ success: boolean }> => {
    try { await api.post('/auth/logout'); }
    finally { tokenStore.clear(); emit(AUTH_LOGGED_OUT_EVENT); }
    return { success: true };
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const r = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
    if (r.data.token && r.data.refreshToken) tokenStore.set(r.data.token, r.data.refreshToken);
    else if (r.data.token) tokenStore.setAccess(r.data.token);
    else if (r.data.refreshToken) tokenStore.setRefresh(r.data.refreshToken);
    return r.data;
  },

  me: (): Promise<User> => api.get<User>('/auth/me').then(r => r.data),

  forgotPassword: (email: string): Promise<void> =>
    api
      .post<void>('/auth/forgot-password', { email }, { skipGlobalLoader: true })
      .then(r => r.data),

  resetPassword: (b: { email: string; otp: string; newPassword: string }): Promise<void> =>
    api
      .post<void>('/auth/reset-password', b, { skipGlobalLoader: true })
      .then(r => r.data),

  checkSignupEmail: (email: string): Promise<{ available: boolean }> =>
    api
      .post<{ available: boolean }>('/auth/onboarding/check-email', { email }, { skipGlobalLoader: true })
      .then(r => r.data),

  sendOnboardingVerificationOtp: (b: { email: string; firstName?: string }): Promise<OnboardingOtpSentResponse> =>
    api
      .post<OnboardingOtpSentResponse>('/auth/onboarding/send-verification-otp', b, { skipGlobalLoader: true })
      .then(r => r.data),

  resendOnboardingVerificationOtp: (email: string): Promise<OnboardingOtpSentResponse> =>
    api
      .post<OnboardingOtpSentResponse>(
        '/auth/onboarding/resend-verification-otp',
        { email },
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

  parseOnboardingCv: (file: File): Promise<OnboardingCvParseResponse> => {
    const fd = new FormData();
    fd.append('file', file);
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
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  },
  stats: () => api.get('/profile/stats').then(r => r.data),
  addPortfolioItem: (body: { title: string; url?: string; description?: string; techTags?: string[] }) =>
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
      if (!batch.hasMore || batch.items.length < JOBS_PAGE_SIZE) break;
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
