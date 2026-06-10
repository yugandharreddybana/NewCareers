import { isAxiosError } from 'axios';
import type { User } from '@/types';
import { hasPendingSignup } from '@/lib/pendingSignup';

export const SESSION_EXPIRED_SIGNUP_REDIRECT = '/signup?reason=session_expired';
export const SESSION_EXPIRED_LOGIN_REDIRECT = '/login?reason=session_expired';

/** Set before clearing tokens so ProtectedRoute can show the session-expired login banner. */
export const SESSION_EXPIRED_FLAG_KEY = 'co_session_expired';

export function markSessionExpired(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_EXPIRED_FLAG_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeSessionExpiredFlag(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const expired = sessionStorage.getItem(SESSION_EXPIRED_FLAG_KEY) === '1';
    if (expired) sessionStorage.removeItem(SESSION_EXPIRED_FLAG_KEY);
    return expired;
  } catch {
    return false;
  }
}

/** @deprecated Use SESSION_EXPIRED_SIGNUP_REDIRECT */
export const ONBOARDING_SIGNUP_REDIRECT = SESSION_EXPIRED_SIGNUP_REDIRECT;

export function isOnboardingPath(pathname?: string): boolean {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return path === '/onboarding';
}

export function hasActiveOnboardingSession(user?: User | null): boolean {
  return hasPendingSignup() || Boolean(user && !user.onboarded);
}

/**
 * Target after invalid/expired token.
 * On onboarding: deferred signup → signup; authenticated mid-onboarding → stay (null).
 */
export function getSessionExpiredRedirectTarget(
  pathname: string,
  options?: { user?: User | null },
): string | null {
  if (isOnboardingPath(pathname)) {
    if (hasPendingSignup()) {
      return SESSION_EXPIRED_SIGNUP_REDIRECT;
    }
    if (options?.user && !options.user.onboarded) {
      return null;
    }
    return SESSION_EXPIRED_LOGIN_REDIRECT;
  }
  return SESSION_EXPIRED_LOGIN_REDIRECT;
}

/** Navigate to login/signup with session-expired reason (full page load for reliability). */
export function redirectOnSessionExpired(
  pathname?: string,
  options?: { user?: User | null },
): void {
  if (typeof window === 'undefined') return;
  const here = pathname ?? window.location.pathname;
  const target = getSessionExpiredRedirectTarget(here, options);
  if (!target) return;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === target) return;
  markSessionExpired();
  window.location.assign(target);
}

/** True when an API or auth error indicates an invalid or expired session. */
export function isAuthFailureError(err: unknown): boolean {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 401) return true;
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
