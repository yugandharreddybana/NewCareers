import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getSessionExpiredRedirectTarget } from './onboardingSession';

vi.mock('./pendingSignup', () => ({
  hasPendingSignup: vi.fn(),
}));

import { hasPendingSignup } from './pendingSignup';

describe('getSessionExpiredRedirectTarget', () => {
  beforeEach(() => {
    vi.mocked(hasPendingSignup).mockReturnValue(false);
  });

  it('redirects onboarding without intent to login', () => {
    expect(getSessionExpiredRedirectTarget('/onboarding')).toBe('/login?reason=session_expired');
  });

  it('redirects onboarding with pending signup to signup', () => {
    vi.mocked(hasPendingSignup).mockReturnValue(true);
    expect(getSessionExpiredRedirectTarget('/onboarding')).toBe('/signup?reason=session_expired');
  });
});
