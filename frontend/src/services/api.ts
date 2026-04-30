import axios from 'axios';

const baseURL = import.meta.env.VITE_MIDDLEWARE_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  withCredentials: true,
  timeout: 90_000,
});

api.interceptors.response.use(
  r => r,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed';
    err.normalizedMessage = msg;
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  signup: (b: { name: string; username: string; email: string; password: string }) =>
    api.post('/auth/signup', b).then(r => r.data),
  login:  (b: { email: string; password: string }) =>
    api.post('/auth/login', b).then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  forgot: (email: string) => api.post('/auth/forgot-password', { email }).then(r => r.data),
  reset:  (b: { email: string; otp: string; newPassword: string }) =>
    api.post('/auth/reset-password', b).then(r => r.data),
};

// Profile
export const profileApi = {
  get:    () => api.get('/profile').then(r => r.data),
  update: (b: object) => api.put('/profile', b).then(r => r.data),
  uploadCv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/profile/cv', fd).then(r => r.data);
  },
  cvDownload: () => api.get('/profile/cv/download').then(r => r.data),
  stats:  () => api.get('/profile/stats').then(r => r.data),
};

// Jobs
export const jobsApi = {
  list:   () => api.get('/jobs').then(r => r.data),
  detail: (id: string) => api.get(`/jobs/${id}`).then(r => r.data),
  fetch:  (count = 5) => api.post('/jobs/fetch', null, { params: { count } }).then(r => r.data),
  limits: () => api.get('/jobs/limits').then(r => r.data),
  stats:  () => api.get('/jobs/stats').then(r => r.data),
};

// Kanban
export const kanbanApi = {
  patch:    (id: string, body: { kanbanColumn?: string; status?: string }) =>
    api.patch(`/kanban/${id}`, body).then(r => r.data),
  uploadCv: (id: string, file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post(`/kanban/${id}/cv`, fd).then(r => r.data);
  }
};

/**
 * Skills API — all 9 skills unified under /skills/start
 * Old per-skill methods kept for backward compatibility during migration.
 * New code should import from services/skillsApi.ts instead.
 */
export const skillsApi = {
  // ── NEW unified endpoints (use these) ─────────────────────────
  start: (req: object) =>
    api.post('/skills/start', req, { timeout: 180_000 }).then(r => r.data),

  reply: (req: { conversationId: string; answer: string }) =>
    api.post('/skills/conversation/reply', req, { timeout: 180_000 }).then(r => r.data),

  runAll: (userJobId: string) =>
    api.post(`/skills/run-all/${userJobId}`, null, { timeout: 600_000 }).then(r => r.data),

  getLastRun: (userJobId: string, skill: string) =>
    api.get(`/skills/last-run/${userJobId}/${skill}`).then(r => r.data),

  // ── PDF downloads ──────────────────────────────────────────
  downloadSkillPdf: (userJobId: string, skillName: string) =>
    api.get(`/skills/pdf/${userJobId}/${skillName}`, { responseType: 'blob', timeout: 60_000 })
      .then(r => {
        const url  = window.URL.createObjectURL(r.data);
        const link = document.createElement('a');
        link.href = url; link.download = `${skillName}-report.pdf`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }),

  downloadAllPdf: (userJobId: string) =>
    api.get(`/skills/pdf/${userJobId}/all`, { responseType: 'blob', timeout: 120_000 })
      .then(r => {
        const url  = window.URL.createObjectURL(r.data);
        const link = document.createElement('a');
        link.href = url; link.download = 'careerops-complete-pack.pdf';
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }),

  downloadResumePdf: (userJobId: string) =>
    api.get(`/skills/pdf/${userJobId}/resume`, { responseType: 'blob', timeout: 60_000 })
      .then(r => {
        const url  = window.URL.createObjectURL(r.data);
        const link = document.createElement('a');
        link.href = url; link.download = 'tailored-resume.pdf';
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }),

  // ── Legacy aliases (kept for backward compat — will be removed in Phase 2) ──
  /** @deprecated Use skillsApi.start({ skillName: 'evaluate', userJobId }) */
  evaluate:      (userJobId: string) =>
    api.post('/skills/start', { skillName: 'evaluate', userJobId }, { timeout: 180_000 }).then(r => r.data),
  /** @deprecated Use skillsApi.start({ skillName: 'tailor-resume', userJobId }) */
  tailorResume:  (userJobId: string) =>
    api.post('/skills/start', { skillName: 'tailor-resume', userJobId }, { timeout: 180_000 }).then(r => r.data),
  /** @deprecated */
  research:      (userJobId: string) =>
    api.post('/skills/start', { skillName: 'research', userJobId }, { timeout: 180_000 }).then(r => r.data),
  /** @deprecated */
  outreach: (userJobId: string, channel = 'linkedin', tone = 'professional') =>
    api.post('/skills/start', { skillName: 'outreach', userJobId, channel, tone }, { timeout: 180_000 }).then(r => r.data),
  /** @deprecated */
  apply: (userJobId: string, step = 'all') =>
    api.post('/skills/start', { skillName: 'apply', userJobId, step }, { timeout: 180_000 }).then(r => r.data),
  /** @deprecated */
  prepInterview: (userJobId: string) =>
    api.post('/skills/start', { skillName: 'prep-interview', userJobId }, { timeout: 180_000 }).then(r => r.data),
  /** @deprecated */
  compare: (userJobIds: string[]) =>
    api.post('/skills/start', { skillName: 'compare', compareJobIds: userJobIds }, { timeout: 180_000 }).then(r => r.data),
  /** @deprecated */
  triage: () =>
    api.post('/skills/start', { skillName: 'triage' }, { timeout: 180_000 }).then(r => r.data),
  /** @deprecated */
  last: (userJobId: string, skill: string) =>
    api.get(`/skills/last-run/${userJobId}/${skill}`).then(r => r.data),
};
