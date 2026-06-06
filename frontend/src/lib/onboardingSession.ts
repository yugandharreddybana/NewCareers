import { isAxiosError } from 'axios';

export const SESSION_EXPIRED_SIGNUP_REDIRECT = '/signup?reason=session_expired';
export const SESSION_EXPIRED_LOGIN_REDIRECT = '/login?reason=session_expired';

/** @deprecated Use SESSION_EXPIRED_SIGNUP_REDIRECT */
export const ONBOARDING_SIGNUP_REDIRECT = SESSION_EXPIRED_SIGNUP_REDIRECT;

export function isOnboardingPath(pathname?: string): boolean {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return path === '/onboarding';
}

/**
 * Target after invalid/expired token: signup during onboarding, login everywhere else.
 */
export function getSessionExpiredRedirectTarget(pathname: string): string {
  return isOnboardingPath(pathname)
    ? SESSION_EXPIRED_SIGNUP_REDIRECT
    : SESSION_EXPIRED_LOGIN_REDIRECT;
}

/** Replace history with the session-expired redirect for the given path. */
export function redirectOnSessionExpired(pathname?: string): void {
  if (typeof window === 'undefined') return;
  const here = pathname ?? window.location.pathname;
  const target = getSessionExpiredRedirectTarget(here);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === target) return;
  window.history.replaceState({ reason: 'session_expired' }, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** True when an API or auth error indicates an invalid or expired session. */
export function isAuthFailureError(err: unknown): boolean {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 401 || status === 403) return true;
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (
      m.includes('session expired') ||
      m.includes('sign in again') ||
      m.includes('unauthorized') ||
      m.includes('invalid token')
    ) {
      return true;
    }
  }
  return false;
}
