/**
 * tokenStore.ts — single source of truth for JWT storage.
 *
 * Security model (A1 fix):
 *  - Access token  → sessionStorage  (cleared on tab close, not XSS-persistent)
 *  - Refresh token → localStorage    (intentional: must survive tab close for silent refresh)
 *
 * Rationale: storing the access token in localStorage means any injected script
 * can silently exfiltrate it. sessionStorage limits the blast radius to the
 * current tab session. The refresh token remains in localStorage so the silent-
 * refresh interceptor in api.ts can still obtain a new access token after a
 * page reload without forcing the user to log in again.
 *
 * Rules:
 *  - Never import localStorage/sessionStorage directly elsewhere; always go
 *    through this module.
 *  - Both tokens are cleared atomically on logout.
 */

const ACCESS_KEY  = 'co_token';
const REFRESH_KEY = 'co_refresh';

export const tokenStore = {
  // ── Access token (sessionStorage — cleared on tab close) ────────────────
  getAccess(): string | null {
    return sessionStorage.getItem(ACCESS_KEY);
  },

  setAccess(token: string): void {
    sessionStorage.setItem(ACCESS_KEY, token);
  },

  hasAccess(): boolean {
    return !!sessionStorage.getItem(ACCESS_KEY);
  },

  // ── Refresh token (localStorage — survives page reload) ─────────────────
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },

  setRefresh(token: string): void {
    localStorage.setItem(REFRESH_KEY, token);
  },

  hasRefresh(): boolean {
    return !!localStorage.getItem(REFRESH_KEY);
  },

  /** Store both tokens atomically after login / signup / silent refresh. */
  set(accessToken: string, refreshToken: string): void {
    sessionStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },

  /**
   * Wipe both tokens atomically on logout or unrecoverable session expiry.
   * Also removes legacy localStorage access-token entry in case it exists
   * from a previous version of this module.
   */
  clear(): void {
    sessionStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    // Remove legacy entry written by older tokenStore versions
    localStorage.removeItem(ACCESS_KEY);
  },
};
