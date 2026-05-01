/**
 * Task 139 — Admin API client.
 * All requests include X-Internal-Secret header.
 * Only accessible from the Admin page (role-gated).
 */
import { api } from '@/services/api';

const secret = () => ({
  headers: { 'X-Internal-Secret': import.meta.env.VITE_INTERNAL_SECRET || '' },
});

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
  /** Platform-wide stats for the admin dashboard */
  getStats: (): Promise<AdminStats> =>
    api.get('/admin/stats', secret()).then(r => r.data),

  /** List all feature flags */
  getFlags: (): Promise<FeatureFlag[]> =>
    api.get('/admin/flags', secret()).then(r => r.data),

  /** Toggle a feature flag on or off */
  toggleFlag: (key: string, enabled: boolean): Promise<FeatureFlag> =>
    api.post('/admin/flags/toggle', { key, enabled }, secret()).then(r => r.data),

  /** List all users */
  listUsers: (page = 1, limit = 20): Promise<{ users: AdminUser[]; total: number }> =>
    api.get('/admin/users', { ...secret(), params: { page, limit } }).then(r => r.data),

  /** Hard-delete a user account */
  deleteUser: (userId: string): Promise<{ success: boolean }> =>
    api.delete(`/admin/users/${userId}`, secret()).then(r => r.data),

  /** Impersonate a user (returns a short-lived token) */
  impersonate: (userId: string): Promise<{ token: string }> =>
    api.post(`/admin/users/${userId}/impersonate`, {}, secret()).then(r => r.data),
};
