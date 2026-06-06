import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SESSION_EXPIRED_LOGIN_REDIRECT,
  SESSION_EXPIRED_SIGNUP_REDIRECT,
  getSessionExpiredRedirectTarget,
  redirectOnSessionExpired,
} from './onboardingSession';

describe('onboardingSession redirect policy', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '' },
      history: { replaceState: vi.fn() },
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getSessionExpiredRedirectTarget', () => {
    it('returns signup redirect for /onboarding', () => {
      expect(getSessionExpiredRedirectTarget('/onboarding')).toBe(
        SESSION_EXPIRED_SIGNUP_REDIRECT,
      );
    });

    it('returns login redirect for protected app routes', () => {
      expect(getSessionExpiredRedirectTarget('/dashboard')).toBe(
        SESSION_EXPIRED_LOGIN_REDIRECT,
      );
      expect(getSessionExpiredRedirectTarget('/profile')).toBe(
        SESSION_EXPIRED_LOGIN_REDIRECT,
      );
    });

    it('returns login redirect for public non-onboarding routes', () => {
      expect(getSessionExpiredRedirectTarget('/login')).toBe(
        SESSION_EXPIRED_LOGIN_REDIRECT,
      );
      expect(getSessionExpiredRedirectTarget('/signup')).toBe(
        SESSION_EXPIRED_LOGIN_REDIRECT,
      );
    });
  });

  describe('redirectOnSessionExpired', () => {
    it('navigates to signup when pathname is /onboarding', () => {
      redirectOnSessionExpired('/onboarding');
      expect(window.history.replaceState).toHaveBeenCalledWith(
        { reason: 'session_expired' },
        '',
        SESSION_EXPIRED_SIGNUP_REDIRECT,
      );
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it('navigates to login when pathname is a protected route', () => {
      redirectOnSessionExpired('/dashboard');
      expect(window.history.replaceState).toHaveBeenCalledWith(
        { reason: 'session_expired' },
        '',
        SESSION_EXPIRED_LOGIN_REDIRECT,
      );
    });

    it('is a no-op when already on the target URL', () => {
      vi.stubGlobal('window', {
        location: { pathname: '/login', search: '?reason=session_expired' },
        history: { replaceState: vi.fn() },
        dispatchEvent: vi.fn(),
      });
      redirectOnSessionExpired('/dashboard');
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });
});
