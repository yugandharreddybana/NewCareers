import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { getSessionExpiredRedirectTarget, isAuthFailureError, redirectOnSessionExpired } from './onboardingSession';

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

  it('does not treat generic 403 responses as expired sessions', () => {
    const err = new AxiosError('Request failed with status code 403');
    err.response = { status: 403, data: {}, statusText: 'Forbidden', headers: {}, config: {} as never };
    expect(isAuthFailureError(err)).toBe(false);
  });

  it('treats 401 responses as expired sessions', () => {
    const err = new AxiosError('Request failed with status code 401');
    err.response = { status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config: {} as never };
    expect(isAuthFailureError(err)).toBe(true);
  });

  it('redirectOnSessionExpired uses full navigation', () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/jobs/abc', search: '', assign },
      writable: true,
    });
    redirectOnSessionExpired('/jobs/abc');
    expect(assign).toHaveBeenCalledWith('/login?reason=session_expired');
    expect(sessionStorage.getItem('co_session_expired')).toBe('1');
    sessionStorage.removeItem('co_session_expired');
  });
});
