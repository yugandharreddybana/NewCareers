import { describe, expect, it } from 'vitest';
import {
  isPublicAuthApiPath,
  PUBLIC_AUTH_API_PATHS,
  shouldBreakJobPagination,
  shouldRedirectOnAuthFailure,
  shouldSkipInitialSessionProbe,
} from '@/services/api';
import { tokenStore } from '@/lib/tokenStore';

describe('public auth API helpers', () => {
  it('recognises pre-auth onboarding paths', () => {
    expect(PUBLIC_AUTH_API_PATHS.has('/auth/signup-intent')).toBe(true);
    expect(PUBLIC_AUTH_API_PATHS.has('/auth/google')).toBe(true);
    expect(PUBLIC_AUTH_API_PATHS.has('/auth/two-factor/verify')).toBe(true);
    expect(PUBLIC_AUTH_API_PATHS.has('/auth/google/link/confirm')).toBe(true);
    expect(PUBLIC_AUTH_API_PATHS.has('/auth/refresh')).toBe(true);
    expect(PUBLIC_AUTH_API_PATHS.has('/auth/onboarding/check-email')).toBe(true);
    expect(PUBLIC_AUTH_API_PATHS.has('/auth/onboarding/check-password')).toBe(true);
    expect(isPublicAuthApiPath('/auth/onboarding/parse-cv')).toBe(true);
    expect(isPublicAuthApiPath('/api/v1/auth/onboarding/check-email')).toBe(true);
    expect(isPublicAuthApiPath('/api/v1/auth/onboarding/check-password')).toBe(true);
    expect(isPublicAuthApiPath('/api/v1/auth/two-factor/verify')).toBe(true);
    expect(isPublicAuthApiPath('/api/v1/auth/google/link/confirm')).toBe(true);
    expect(isPublicAuthApiPath('/auth/me')).toBe(false);
  });

  it('skips session probe on signup without tokens', () => {
    tokenStore.clear();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/signup' },
      writable: true,
    });
    expect(shouldSkipInitialSessionProbe()).toBe(true);
  });

  it('does not skip session probe on login when refresh token exists', () => {
    tokenStore.set('access.stub', 'refresh.stub');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/login' },
      writable: true,
    });
    expect(shouldSkipInitialSessionProbe()).toBe(false);
    tokenStore.clear();
  });

  it('does not skip session probe when valid access token exists', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp: futureExp }));
    tokenStore.setAccessOnly(`header.${payload}.sig`);
    Object.defineProperty(window, 'location', {
      value: { pathname: '/signup' },
      writable: true,
    });
    expect(shouldSkipInitialSessionProbe()).toBe(false);
    tokenStore.clear();
  });

  it('shouldRedirectOnAuthFailure skips deferred signup on /onboarding', () => {
    expect(shouldRedirectOnAuthFailure('/onboarding', false)).toBe(false);
    expect(shouldRedirectOnAuthFailure('/onboarding', true)).toBe(false);
    expect(shouldRedirectOnAuthFailure('/dashboard', false)).toBe(true);
    expect(shouldRedirectOnAuthFailure('/login', false)).toBe(false);
  });

  it('shouldRedirectOnAuthFailure never redirects from public landing paths', () => {
    expect(shouldRedirectOnAuthFailure('/', false)).toBe(false);
    expect(shouldRedirectOnAuthFailure('/', true)).toBe(false);
    expect(shouldRedirectOnAuthFailure('/billing', false)).toBe(false);
    expect(shouldRedirectOnAuthFailure('/get-started', true)).toBe(false);
  });

  it('skips session probe on home without tokens', () => {
    tokenStore.clear();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
    });
    expect(shouldSkipInitialSessionProbe()).toBe(true);
  });

  it('probes session on home when a refresh cookie exists', () => {
    tokenStore.set('access.stub', 'refresh.stub');
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
    });
    expect(shouldSkipInitialSessionProbe()).toBe(false);
    tokenStore.clear();
  });

  it('skips session probe on billing without tokens', () => {
    tokenStore.clear();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/billing' },
      writable: true,
    });
    expect(shouldSkipInitialSessionProbe()).toBe(true);
  });

  it('shouldBreakJobPagination stops on empty page or hasMore false', () => {
    expect(shouldBreakJobPagination(false, 200)).toBe(true);
    expect(shouldBreakJobPagination(true, 0)).toBe(true);
    expect(shouldBreakJobPagination(true, 200)).toBe(false);
  });
});
