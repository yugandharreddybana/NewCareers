import { describe, expect, it } from 'vitest';
import { computeTrialDaysRemaining } from '@/lib/subscriptionUtils';

describe('computeTrialDaysRemaining', () => {
  it('returns 0 when trialEndsAt is null', () => {
    expect(computeTrialDaysRemaining(null)).toBe(0);
  });

  it('returns remaining whole days until trial end', () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000 + 60_000).toISOString();
    expect(computeTrialDaysRemaining(inThreeDays)).toBeGreaterThanOrEqual(3);
    expect(computeTrialDaysRemaining(inThreeDays)).toBeLessThanOrEqual(4);
  });

  it('returns 0 for expired trials', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect(computeTrialDaysRemaining(yesterday)).toBe(0);
  });
});
