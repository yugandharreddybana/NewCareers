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
 *                    backend outages with fake data. Mocks are now strictly
 *                    gated behind `USE_MOCKS` (VITE_USE_MOCKS=true).
 *
 * F1 / F2 / F3 / F4 / G7 fixes preserved.
 */
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import * as mocks from './mockApi';
import { tokenStore } from '@/lib/tokenStore';
import { reportError } from '@/lib/telemetry';
import { API_V1_URL, USE_MOCKS, DEV_BYPASS } from '@/lib/env';
import type { User, Profile, KanbanColumn } from '@/types';

// ── Typed request bodies ────────────────────────────────────────────────────
interface SignupBody {
  name: string;
  username: string;
  email: string;
  password: string;
}
interface LoginBody {
  email: string;
  password: string;
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

const IS_TEST = import.meta.env.MODE === 'test';
const delay = (ms = 800) => IS_TEST ? Promise.resolve() : new Promise(res => setTimeout(res, ms));

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
  if (token && config.headers) {
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
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
]);

function redirectToLoginIfNeeded(): void {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname;
  if (DEV_BYPASS || PUBLIC_PATHS_FRONTEND.has(here)) return;
  const target = '/login?reason=session_expired';
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === target) return;
  window.history.replaceState({ reason: 'session_expired' }, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// ── Response interceptor: 401 → silent refresh, 429 → toast, others → normalise ──
api.interceptors.response.use(
  r => r,
  async (err: AxiosError<{ error?: string; message?: string }>) => {
    const originalRequest = err.config as AxiosRequestConfig | undefined;

    // 429 → user-facing toast
    if (err.response?.status === 429) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Too many requests — please slow down.';
      toast.error(msg, { id: 'rate-limit', duration: 4000 });
      (err as AxiosError & { normalizedMessage: string }).normalizedMessage = msg;
      return Promise.reject(err);
    }

    // 401 → silent refresh + retry once.
    const isRefreshableRequest =
      originalRequest &&
      err.response?.status === 401 &&
      !retriedConfigs.has(originalRequest) &&
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/login';

    if (isRefreshableRequest) {
      if (DEV_BYPASS) return Promise.reject(err);

      const refresh = tokenStore.getRefresh();
      if (!refresh) {
        tokenStore.clear();
        emit(AUTH_LOGGED_OUT_EVENT);
        redirectToLoginIfNeeded();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(newToken => {
          if (originalRequest.headers) {
            (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
          }
          return api(originalRequest);
        });
      }

      retriedConfigs.add(originalRequest);
      isRefreshing = true;

      try {
        // Use a clean axios call (NOT the instance) so the interceptor doesn't
        // recurse on its own 401.
        const resp = await axios.post(
          `${API_V1_URL}/auth/refresh`,
          { refreshToken: refresh },
          { 
            withCredentials: true, 
            timeout: 30_000,
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          },
        );
        const data = resp.data as { token: string; refreshToken: string };
        tokenStore.set(data.token, data.refreshToken);
        processQueue(null, data.token);
        emit(AUTH_REFRESHED_EVENT);
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${data.token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        tokenStore.clear();
        emit(AUTH_LOGGED_OUT_EVENT);
        redirectToLoginIfNeeded();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For any other error, attach a normalised message + report 5xx to telemetry.
    const normalized = err.response?.data?.error
      || err.response?.data?.message
      || err.message
      || 'Request failed';
    (err as AxiosError & { normalizedMessage: string }).normalizedMessage = normalized;

    if (err.response && err.response.status >= 500) {
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
  stats: async (): Promise<PublicStats> => {
    if (USE_MOCKS) {
      await delay(150);
      return { jobs: 0, users: 0, skills: 14 };
    }
    const r = await api.get<PublicStats>('/public/stats');
    return r.data;
  },
};

// ── Auth API ──────────────────────────────────────────────────────────────
export const authApi = {
  signup: async (b: SignupBody): Promise<AuthResponse> => {
    if (USE_MOCKS) { await delay(); return { user: mocks.MOCK_USER }; }
    // Backend convention: POST /auth/register; middleware aliases /auth/signup → /auth/register.
    const r = await api.post<AuthResponse>('/auth/signup', b);
    if (r.data.token)        tokenStore.setAccess(r.data.token);
    if (r.data.refreshToken) tokenStore.setRefresh(r.data.refreshToken);
    return r.data;
  },

  login: async (b: LoginBody): Promise<AuthResponse> => {
    if (USE_MOCKS) { await delay(); return { user: mocks.MOCK_USER }; }
    const r = await api.post<AuthResponse>('/auth/login', b);
    if (r.data.token)        tokenStore.setAccess(r.data.token);
    if (r.data.refreshToken) tokenStore.setRefresh(r.data.refreshToken);
    return r.data;
  },

  logout: async (): Promise<{ success: boolean }> => {
    if (USE_MOCKS) { await delay(200); return { success: true }; }
    try { await api.post('/auth/logout'); }
    finally { tokenStore.clear(); emit(AUTH_LOGGED_OUT_EVENT); }
    return { success: true };
  },

  refresh: (refreshToken: string): Promise<AuthResponse> =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }).then(r => r.data),

  me: (): Promise<User> => api.get<User>('/auth/me').then(r => r.data),

  forgotPassword: (email: string): Promise<void> =>
    api.post<void>('/auth/forgot-password', { email }).then(r => r.data),

  resetPassword: (b: { token: string; password: string }): Promise<void> =>
    api.post<void>('/auth/reset-password', b).then(r => r.data),
};

// ── Profile API ───────────────────────────────────────────────────────────
export const profileApi = {
  get: async (): Promise<Profile> => {
    if (USE_MOCKS) { await delay(400); return mocks.MOCK_USER; }
    return api.get<Profile>('/profile').then(r => r.data);
  },
  update: (b: object) => api.put<Profile>('/profile', b).then(r => r.data),
  uploadCv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<{ fileName: string }>('/profile/cv', fd).then(r => r.data);
  },
  cvDownload: () => api.get<{ url: string }>('/profile/cv/download').then(r => r.data),
  stats: async () => {
    if (USE_MOCKS) { await delay(300); return mocks.MOCK_STATS; }
    return api.get('/profile/stats').then(r => r.data);
  },
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

// ── Jobs API ──────────────────────────────────────────────────────────────
// Pass 6 #8.010 — silent mock fallbacks removed. If USE_MOCKS is off and the
// backend errors, the error propagates so the UI can show a real failure
// state instead of fake data.
export const jobsApi = {
  list: async () => {
    if (USE_MOCKS) {
      await delay(500);
      return { items: mocks.MOCK_JOBS, dailyCount: 5, dailyLimit: 15, remaining: 10 };
    }
    return api.get('/jobs').then(r => r.data);
  },
  detail: async (id: string) => {
    if (USE_MOCKS) { await delay(300); return mocks.MOCK_JOB_DETAIL; }
    return api.get(`/jobs/${id}`).then(r => r.data);
  },
  fetch: async (count = 5) => {
    if (USE_MOCKS) { await delay(800); return mocks.MOCK_FETCH_SUMMARY; }
    return api.post('/jobs/fetch', null, { params: { count } }).then(r => r.data);
  },
  limits: async () => {
    if (USE_MOCKS) return mocks.MOCK_FETCH_SUMMARY;
    return api.get('/jobs/limits').then(r => r.data);
  },
  stats: async () => {
    if (USE_MOCKS) return mocks.MOCK_STATS;
    return api.get('/jobs/stats').then(r => r.data);
  },
};

// ── Kanban API ────────────────────────────────────────────────────────────
export const kanbanApi = {
  patch: (id: string, body: { kanbanColumn?: KanbanColumn; status?: string }) => {
    if (USE_MOCKS) return Promise.resolve({ success: true });
    return api.patch(`/kanban/${id}`, body).then(r => r.data);
  },
  uploadCv: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/kanban/${id}/cv`, fd).then(r => r.data);
  },
};

// Pass 6 #6.012 — canonical SkillStartRequest / SkillRunResponse and
// the `skillsApi` client live in `services/skillsApi.ts`.
