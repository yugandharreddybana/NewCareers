import { api } from './api';
import { tokenStore } from '@/lib/tokenStore';
import type { User } from '@/types';

export interface SessionItem {
  id: string;
  deviceInfo: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
  createdAt: string;
}

export interface SecurityActivityItem {
  id: string;
  title: string;
  subtitle: string;
  action: string;
  createdAt: string;
}

export interface SecurityActivityResponse {
  entries: SecurityActivityItem[];
  total: number;
  page: number;
  size: number;
}

export interface TwoFactorStatus {
  enabled: boolean;
  rolloutEnabled: boolean;
  enabledAt: string | null;
}

export interface TwoFactorSetup {
  otpauthUri: string;
  secretBase32: string;
}

export const securityApi = {
  changePassword: async (body: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ token?: string; user: User }> => {
    const r = await api.patch<{ token?: string; user: User }>('/account/password', body);
    if (r.data.token) tokenStore.setAccessOnly(r.data.token);
    return r.data;
  },

  listSessions: (): Promise<SessionItem[]> =>
    api.get<SessionItem[]>('/account/sessions').then(r => r.data),

  revokeSession: (sessionId: string): Promise<void> =>
    api.delete(`/account/sessions/${sessionId}`).then(() => undefined),

  revokeOtherSessions: (): Promise<{ revoked: number }> =>
    api.post<{ revoked: number }>('/account/sessions/revoke-others', {}).then(r => r.data),

  getActivity: (page = 0, size = 10): Promise<SecurityActivityResponse> =>
    api
      .get<SecurityActivityResponse>('/account/security/activity', { params: { page, size } })
      .then(r => r.data),

  getTwoFactorStatus: (): Promise<TwoFactorStatus> =>
    api.get<TwoFactorStatus>('/account/two-factor/status').then(r => r.data),

  setupTwoFactor: (): Promise<TwoFactorSetup> =>
    api.post<TwoFactorSetup>('/account/two-factor/setup', {}).then(r => r.data),

  enableTwoFactor: (code: string): Promise<{ backupCodes: string[] }> =>
    api.post<{ backupCodes: string[] }>('/account/two-factor/enable', { code }).then(r => r.data),

  disableTwoFactor: (currentPassword: string): Promise<void> =>
    api.post('/account/two-factor/disable', { currentPassword }).then(() => undefined),
};
