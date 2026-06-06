import { describe, expect, it } from 'vitest';
import { isPublicAuthApiPath, PUBLIC_AUTH_API_PATHS, shouldSkipInitialSessionProbe } from '@/services/api';
import { tokenStore } from '@/lib/tokenStore';

describe('public auth API helpers', () => {
  it('recognises pre-auth onboarding paths', () => {
    expect(PUBLIC_AUTH_API_PATHS.has('/auth/onboarding/check-email')).toBe(true);
    expect(isPublicAuthApiPath('/auth/onboarding/parse-cv')).toBe(true);
    expect(isPublicAuthApiPath('/api/v1/auth/onboarding/check-email')).toBe(true);
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
});
