/**
 * Admin API client.
 * Browser requests rely on normal user auth; internal trust secrets must stay server-side.
 */
import { api } from '@/services/api';

export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  totalJobs: number;
  skillRunsToday: number;
  applicationsSubmitted: number;
};

export type FeatureFlag = {
  key: string;
  label: string;
  enabled: boolean;
  description?: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  plan: string;
  jobCount: number;
};

export const adminApi = {
  getStats: (): Promise<AdminStats> =>
    api.get('/admin/stats').then(r => r.data),

  getFlags: (): Promise<FeatureFlag[]> =>
    api.get('/admin/flags').then(r => r.data),

  toggleFlag: (key: string, enabled: boolean): Promise<FeatureFlag> =>
    api.post('/admin/flags/toggle', { key, enabled }).then(r => r.data),

  listUsers: (page = 1, limit = 20): Promise<{ users: AdminUser[]; total: number }> =>
    api.get('/admin/users', { params: { page, limit } }).then(r => r.data),

  deleteUser: (userId: string): Promise<{ success: boolean }> =>
    api.delete(`/admin/users/${userId}`).then(r => r.data),

  impersonate: (userId: string): Promise<{ token: string }> =>
    api.post(`/admin/users/${userId}/impersonate`, {}).then(r => r.data),
};
