/**
 * api.ts — Axios instance, silent-refresh interceptor, and core API services.
 *
 * F1 fix: eliminated all `any` types:
 *   authApi.signup(b: any)     → SignupBody
 *   authApi.login(b: any)      → LoginBody
 *   authApi.reset(b: any)      → ResetPasswordBody (alias)
 *   skillsApi.start(req: any)  → SkillStartRequest
 *
 * F2 fix: added authApi.me() — called by AuthContext on mount to verify
 *   the session is still valid (B2 fix in Batch 2 depends on this).
 *
 * F3 fix: kanbanApi.patch body.kanbanColumn typed as KanbanColumn | undefined
 *   (not plain string) so TypeScript catches invalid column names.
 *
 * F4 fix: removed authApi.forgot / authApi.reset legacy aliases.
 *   They were only used in one place (PasswordRecovery.tsx) which already
 *   calls forgotPassword / resetPassword directly. Dead code removed.
 */
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import * as mocks from './mockApi';
import { tokenStore } from '@/lib/tokenStore';
import type { User, KanbanColumn } from '@/types';

// ── F1: typed request bodies ──────────────────────────────────────────────────────────

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

interface SkillStartRequest {
  skillName: string;
  userJobId?: string;
  channel?: string;
  tone?: string;
  step?: string;
  compareJobIds?: string[];
  [key: string]: unknown; // allow extra fields passed through to Java
}

interface SkillResult {
  state: 'idle' | 'loading' | 'done' | 'error';
  data?: Record<string, unknown>;
}

// ── Env ───────────────────────────────────────────────────────────────────────
const baseURL = import.meta.env.VITE_MIDDLEWARE_URL || 'http://localhost:4000';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const DEV_BYPASS =
  import.meta.env.MODE !== 'production' &&
  import.meta.env.VITE_DEV_BYPASS_GUARDS === 'true';

const delay = (ms = 800) => new Promise(res => setTimeout(res, ms));

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  withCredentials: true,
  timeout: 90_000,
});

// ── Request interceptor: attach access token as Bearer header ────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (config.url?.startsWith('/api/')) {
    config.url = config.url.replace(/^\/api\//, '/');
  }
  const token = tokenStore.getAccess();
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Refresh-token machinery ─────────────────────────────────────────────────────
let isRefreshing = false;
type FailedQueueItem = { resolve: (value: string) => void; reject: (reason?: unknown) => void };
let failedQueue: FailedQueueItem[] = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token as string);
  });
  failedQueue = [];
}

// ── Response interceptor: 401 → silent refresh → retry, 429 → toast ───────────
api.interceptors.response.use(
  r => r,
  async (err) => {
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } = err.config;

    if (err.response?.status === 429) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Too many requests — please slow down.';
      toast.error(msg, { id: 'rate-limit', duration: 4000 });
      err.normalizedMessage = msg;
      return Promise.reject(err);
    }

    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/login'
    ) {
      if (DEV_BYPASS) return Promise.reject(err);

      const refresh = tokenStore.getRefresh();
      const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/onboarding'];

      if (!refresh) {
        tokenStore.clear();
        if (!publicPaths.includes(window.location.pathname)) window.location.href = '/login';
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          if (originalRequest.headers) {
            (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const resp = await axios.post(
          `${baseURL}/api/auth/refresh`,
          { refreshToken: refresh },
          { withCredentials: true },
        );
        const { token: newAccess, refreshToken: newRefresh } = resp.data as { token: string; refreshToken: string };
        tokenStore.set(newAccess, newRefresh);
        processQueue(null, newAccess);
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newAccess}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        tokenStore.clear();
        if (!DEV_BYPASS && !publicPaths.includes(window.location.pathname)) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    err.normalizedMessage = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(err);
  },
);

// ── Auth API ─────────────────────────────────────────────────────────────────────
export const authApi = {
  // F1 fix: signup typed
  signup: async (b: SignupBody): Promise<AuthResponse> => {
    if (USE_MOCKS) { await delay(); return { user: mocks.MOCK_USER }; }
    const r = await api.post<AuthResponse>('/auth/signup', b);
    if (r.data.token)        tokenStore.setAccess(r.data.token);
    if (r.data.refreshToken) tokenStore.setRefresh(r.data.refreshToken);
    return r.data;
  },

  // F1 fix: login typed
  login: async (b: LoginBody): Promise<AuthResponse> => {
    if (USE_MOCKS) { await delay(); return { user: mocks.MOCK_USER }; }
    const r = await api.post<AuthResponse>('/auth/login', b);
    if (r.data.token)        tokenStore.setAccess(r.data.token);
    if (r.data.refreshToken) tokenStore.setRefresh(r.data.refreshToken);
    return r.data;
  },

  logout: async (): Promise<{ success: boolean }> => {
    if (USE_MOCKS) { await delay(); return { success: true }; }
    try { await api.post('/auth/logout'); } finally { tokenStore.clear(); }
    return { success: true };
  },

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }).then(r => r.data),

  // F2 fix: authApi.me() — called by AuthContext on mount (B2 fix)
  me: (): Promise<User> =>
    api.get<User>('/auth/me').then(r => r.data),

  forgotPassword: (email: string) =>
    api.post<void>('/auth/forgot-password', { email }).then(r => r.data),

  resetPassword: (b: { token: string; password: string }) =>
    api.post<void>('/auth/reset-password', b).then(r => r.data),

  // F4 fix: dead legacy aliases (forgot / reset) removed
};

// ── Profile API ───────────────────────────────────────────────────────────────────
export const profileApi = {
  get: async (): Promise<User> => {
    if (USE_MOCKS) { await delay(400); return mocks.MOCK_USER; }
    return api.get<User>('/profile').then(r => r.data);
  },
  update: (b: object) => api.put<User>('/profile', b).then(r => r.data),
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

// ── Jobs API ──────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: async () => {
    if (USE_MOCKS) { await delay(1000); return { items: mocks.MOCK_JOBS, dailyCount: 5, dailyLimit: 15, remaining: 10 }; }
    return api.get('/jobs').then(r => r.data).catch(() =>
      ({ items: mocks.MOCK_JOBS, dailyCount: 5, dailyLimit: 15, remaining: 10 })
    );
  },
  detail: async (id: string) => {
    if (USE_MOCKS) { await delay(600); return mocks.MOCK_JOB_DETAIL; }
    return api.get(`/jobs/${id}`).then(r => r.data).catch(() => mocks.MOCK_JOB_DETAIL);
  },
  fetch: async (count = 5) => {
    if (USE_MOCKS) { await delay(2000); return mocks.MOCK_FETCH_SUMMARY; }
    return api.post('/jobs/fetch', null, { params: { count } }).then(r => r.data).catch(() => mocks.MOCK_FETCH_SUMMARY);
  },
  limits: async () => {
    if (USE_MOCKS) return mocks.MOCK_FETCH_SUMMARY;
    return api.get('/jobs/limits').then(r => r.data).catch(() => mocks.MOCK_FETCH_SUMMARY);
  },
  stats: async () => {
    if (USE_MOCKS) return mocks.MOCK_STATS;
    return api.get('/jobs/stats').then(r => r.data).catch(() => mocks.MOCK_STATS);
  },
};

// ── Kanban API ────────────────────────────────────────────────────────────────────
export const kanbanApi = {
  // F3 fix: kanbanColumn typed as KanbanColumn (not plain string)
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

// ── Skills API ────────────────────────────────────────────────────────────────────
export const skillsApi = {
  // F1 fix: start() typed with SkillStartRequest (was `any`)
  start: async (req: SkillStartRequest): Promise<SkillResult> => {
    if (USE_MOCKS) {
      await delay(2500);
      return {
        state: 'done',
        data: (mocks.MOCK_SKILL_RESULTS[req.skillName] as Record<string, unknown>) ??
              { text: 'Skill execution complete.' },
      };
    }
    return api.post<SkillResult>('/skills/start', req, { timeout: 180_000 }).then(r => r.data);
  },

  reply: (req: { conversationId: string; answer: string }) =>
    api.post('/skills/conversation/reply', req, { timeout: 180_000 }).then(r => r.data),

  runAll: async (userJobId: string) => {
    if (USE_MOCKS) { await delay(4000); return { success: true }; }
    return api.post(`/skills/run-all/${userJobId}`, null, { timeout: 600_000 }).then(r => r.data);
  },

  getLastRun: async (userJobId: string, skill: string): Promise<SkillResult> => {
    if (USE_MOCKS) return { state: 'done', data: mocks.MOCK_SKILL_RESULTS[skill] as Record<string, unknown> };
    return api.get<SkillResult>(`/skills/last-run/${userJobId}/${skill}`).then(r => r.data);
  },

  downloadSkillPdf: (userJobId: string, skillName: string): Promise<void> => {
    if (USE_MOCKS) { alert('MOCK: Downloading PDF...'); return Promise.resolve(); }
    return api.get(`/skills/pdf/${userJobId}/${skillName}`, { responseType: 'blob', timeout: 60_000 })
      .then(r => {
        const url = window.URL.createObjectURL(r.data as Blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${skillName}-report.pdf`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      });
  },

  downloadAllPdf: (userJobId: string): Promise<void> => {
    if (USE_MOCKS) { alert('MOCK: Downloading complete pack...'); return Promise.resolve(); }
    return api.get(`/skills/pdf/${userJobId}/all`, { responseType: 'blob', timeout: 120_000 })
      .then(r => {
        const url = window.URL.createObjectURL(r.data as Blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'careerops-complete-pack.pdf';
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      });
  },

  downloadResumePdf: (userJobId: string): Promise<void> => {
    if (USE_MOCKS) { alert('MOCK: Downloading resume...'); return Promise.resolve(); }
    return api.get(`/skills/pdf/${userJobId}/resume`, { responseType: 'blob', timeout: 60_000 })
      .then(r => {
        const url = window.URL.createObjectURL(r.data as Blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'tailored-resume.pdf';
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      });
  },

  // Named skill shortcuts
  evaluate:      (userJobId: string) => skillsApi.start({ skillName: 'evaluate', userJobId }),
  tailorResume:  (userJobId: string) => skillsApi.start({ skillName: 'tailor-resume', userJobId }),
  research:      (userJobId: string) => skillsApi.start({ skillName: 'research', userJobId }),
  outreach:      (userJobId: string, channel = 'linkedin', tone = 'professional') =>
    skillsApi.start({ skillName: 'outreach', userJobId, channel, tone }),
  apply:         (userJobId: string, step = 'all') =>
    skillsApi.start({ skillName: 'apply', userJobId, step }),
  prepInterview: (userJobId: string) =>
    skillsApi.start({ skillName: 'prep-interview', userJobId }),
  compare:       (userJobIds: string[]) =>
    skillsApi.start({ skillName: 'compare', compareJobIds: userJobIds }),
  triage:        () => skillsApi.start({ skillName: 'triage' }),
  last:          (userJobId: string, skill: string) => skillsApi.getLastRun(userJobId, skill),
};
