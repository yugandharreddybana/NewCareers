/**
 * Task 122 — Single source of truth for access-token + refresh-token storage.
 *
 * Stores:
 *   co_token        — short-lived JWT access token
 *   co_refresh      — long-lived opaque refresh token
 *
 * Rules:
 *  - Never import localStorage directly elsewhere; always go through this module.
 *  - Cleared atomically on logout.
 */

const ACCESS_KEY  = 'co_token';
const REFRESH_KEY = 'co_refresh';

export const tokenStore = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },

  setAccess(token: string): void {
    localStorage.setItem(ACCESS_KEY, token);
  },

  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },

  setRefresh(token: string): void {
    localStorage.setItem(REFRESH_KEY, token);
  },

  /** Store both tokens atomically after login / signup / refresh. */
  set(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },

  /** Wipe both tokens atomically on logout or session expiry. */
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },

  hasAccess(): boolean {
    return !!localStorage.getItem(ACCESS_KEY);
  },

  hasRefresh(): boolean {
    return !!localStorage.getItem(REFRESH_KEY);
  },
};
