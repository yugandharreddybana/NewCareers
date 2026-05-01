/**
 * Section 9 — Task 99: Referrals API service.
 */
import api from './api';

// ── Types ────────────────────────────────────────────────────────────────────

export type ReferralStatus = 'pending' | 'signed_up' | 'rewarded';

export interface ReferralDto {
  id:           string;
  refereeEmail: string;
  status:       ReferralStatus;
  createdAt:    string;
  rewardedAt:   string | null;
}

export interface ReferralStats {
  sent:      number;
  signedUp:  number;
  rewarded:  number;
}

export interface MyReferralsResponse {
  referrals: ReferralDto[];
  stats:     ReferralStats;
}

export interface ValidateTokenResponse {
  valid:        boolean;
  referrerName?: string;
  status?:       ReferralStatus;
  tokenType?:    'invite' | 'link';
}

// ── API calls ────────────────────────────────────────────────────────────────

/** POST /api/referrals — send an email invite and create a referral record. */
export const createReferral = (email: string): Promise<ReferralDto> =>
  api.post('/referrals', { email }).then(r => r.data);

/** GET /api/referrals/my — fetch the current user's referrals list + stats. */
export const getMyReferrals = (): Promise<MyReferralsResponse> =>
  api.get('/referrals/my').then(r => r.data);

/**
 * GET /api/referrals/validate/:token
 * Public — called on the Signup page when ?ref=TOKEN is present.
 * Returns referrer name so the UI can show "Invited by <name>".
 */
export const validateToken = (token: string): Promise<ValidateTokenResponse> =>
  api.get(`/referrals/validate/${token}`).then(r => r.data);
