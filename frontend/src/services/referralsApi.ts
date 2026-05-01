/**
 * Section 9 — Task 99
 * Referrals API service.
 */

import { api } from './api';

export type ReferralStatus = 'pending' | 'signed_up' | 'rewarded';

export interface ReferralDto {
  id: string;
  refereeEmail: string;
  status: ReferralStatus;
  createdAt: string;
  rewardedAt: string | null;
}

export interface ReferralStats {
  sent: number;
  signedUp: number;
  rewarded: number;
}

export interface MyReferralsResponse {
  referrals: ReferralDto[];
  stats: ReferralStats;
}

export interface ValidateTokenResponse {
  valid: boolean;
  referrerName?: string;
  status?: ReferralStatus;
  tokenType?: 'invite' | 'link';
}

export const referralsApi = {
  createReferral: async (email: string): Promise<ReferralDto> => {
    const res = await api.post<ReferralDto>('/api/referrals', { email });
    return res.data;
  },

  getMyReferrals: async (): Promise<MyReferralsResponse> => {
    const res = await api.get<MyReferralsResponse>('/api/referrals/my');
    return res.data;
  },

  validateToken: async (token: string): Promise<ValidateTokenResponse> => {
    const res = await api.get<ValidateTokenResponse>(`/api/referrals/validate/${token}`);
    return res.data;
  },
};

export const createReferral = referralsApi.createReferral;
export const getMyReferrals = referralsApi.getMyReferrals;
export const validateToken = referralsApi.validateToken;
