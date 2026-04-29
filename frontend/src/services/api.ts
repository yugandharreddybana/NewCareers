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
  update: (b: any) => api.put('/profile', b).then(r => r.data),
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
  list:    () => api.get('/jobs').then(r => r.data),
  detail:  (id: string) => api.get(`/jobs/${id}`).then(r => r.data),
  fetch:   (count = 5) => api.post('/jobs/fetch', null, { params: { count } }).then(r => r.data),
  limits:  () => api.get('/jobs/limits').then(r => r.data),
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

// Skills
export const skillsApi = {
  evaluate:      (userJobId: string) => api.post('/skills/evaluate', { userJobId }).then(r => r.data),
  tailorResume:  (userJobId: string) => api.post('/skills/tailor-resume', { userJobId }).then(r => r.data),
  research:      (userJobId: string) => api.post('/skills/research', { userJobId }).then(r => r.data),
  outreach:      (userJobId: string, channel = 'linkedin', tone = 'professional') =>
    api.post('/skills/outreach', { userJobId, channel, tone }).then(r => r.data),
  apply:         (userJobId: string, step = 'all') => api.post('/skills/apply', { userJobId, step }).then(r => r.data),
  prepInterview: (userJobId: string) => api.post('/skills/prep-interview', { userJobId }).then(r => r.data),
  compare:       (userJobIds: string[]) => api.post('/skills/compare', { userJobIds }).then(r => r.data),
  triage:        () => api.post('/skills/triage').then(r => r.data),
  last:          (userJobId: string, skill: string) =>
    api.get('/skills/last', { params: { userJobId, skill } }).then(r => r.data),
};
