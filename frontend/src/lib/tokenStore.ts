/**
 * tokenStore.ts — single source of truth for access/refresh tokens.
 *
 * Pass 6 #6.021 — security model rewritten:
 *   - Access token  → in-memory only (zero persistence ⇒ zero XSS surface).
 *   - Refresh token → in-memory only by default; short fallback in
 *                     sessionStorage so a browser-tab refresh does not log
 *                     the user out before the silent /auth/refresh interceptor
 *                     has a chance to run. SessionStorage is cleared on tab
 *                     close, so the long-term threat surface is small.
 *
 *   On a tab refresh:
 *     1. Module re-evaluates → access token blank.
 *     2. AuthContext mount calls /auth/me → 401 (cookie absent or expired).
 *     3. Axios interceptor reads refresh from sessionStorage → /auth/refresh.
 *     4. New access + refresh tokens are stored in memory + sessionStorage.
 *
 *   On a new tab / re-open:
 *     1. SessionStorage is empty → user must sign in. Acceptable because
 *        the alternative (localStorage) leaves long-lived tokens that survive
 *        XSS-driven exfiltration.
 *
 * Subscribers are notified on token changes so the axios queue can re-run
 * pending requests after a successful silent refresh.
 *
 * Replaces the previous localStorage(refresh) + sessionStorage(access) split.
 *
 * IMPORTANT: never re-introduce localStorage usage here without a security
 * review. The audit (1.067 / 9.013 family) tracks this guarantee.
 */

const REFRESH_KEY = 'co_refresh_v2';
const LEGACY_KEYS = ['co_token', 'co_refresh', 'co_user'] as const;

let accessToken: string | null = null;
let refreshToken: string | null = null;
/** True when refresh token lives in HttpOnly cookie (Remember me). */
let refreshViaCookie = false;

const listeners = new Set<(t: string | null) => void>();

/** Best-effort safe sessionStorage get/set/remove (handles SSR, locked-down browsers). */
const safeSession = {
  get(key: string): string | null {
    try { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key); }
    catch { return null; }
  },
  set(key: string, value: string): void {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value); }
    catch { /* ignore quota / privacy errors */ }
  },
  remove(key: string): void {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key); }
    catch { /* ignore */ }
  },
};

/** Wipe any tokens written by a previous version of this module. */
function evictLegacyKeys(): void {
  if (typeof window === 'undefined') return;
  for (const k of LEGACY_KEYS) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    try { sessionStorage.removeItem(k); } catch { /* ignore */ }
  }
}

evictLegacyKeys();

// Re-hydrate refresh token from sessionStorage on module load so a tab
// refresh keeps the user signed in until /auth/refresh resolves.
refreshToken = safeSession.get(REFRESH_KEY);

function notify(): void {
  for (const listener of listeners) listener(accessToken);
}

export const tokenStore = {
  // ── Access token (memory only) ─────────────────────────────────────────
  getAccess(): string | null { return accessToken; },

  setAccess(token: string | null): void {
    accessToken = token && token.length > 0 ? token : null;
    notify();
  },

  hasAccess(): boolean { return accessToken !== null; },

  // ── Refresh token (memory + sessionStorage) ───────────────────────────
  getRefresh(): string | null { return refreshToken; },

  setRefresh(token: string | null): void {
    refreshToken = token && token.length > 0 ? token : null;
    if (refreshToken) safeSession.set(REFRESH_KEY, refreshToken);
    else              safeSession.remove(REFRESH_KEY);
  },

  hasRefresh(): boolean { return refreshToken !== null; },

  /** Refresh may be available via HttpOnly cookie after Remember me login. */
  hasRefreshOrCookie(): boolean { return refreshToken !== null || refreshViaCookie; },

  setRefreshViaCookie(enabled: boolean): void {
    refreshViaCookie = enabled;
    if (enabled) {
      this.setRefresh(null);
    }
  },

  usesCookieRefresh(): boolean { return refreshViaCookie; },

  /** Atomic write of both tokens after login / signup / silent refresh. */
  set(access: string, refresh: string): void {
    refreshViaCookie = false;
    this.setAccess(access);
    this.setRefresh(refresh);
  },

  /** Remember-me login: access in memory, refresh in HttpOnly cookie. */
  setAccessOnly(access: string): void {
    refreshViaCookie = true;
    this.setAccess(access);
    this.setRefresh(null);
  },

  /** Atomic clear on logout / unrecoverable session error. */
  clear(): void {
    refreshViaCookie = false;
    this.setAccess(null);
    this.setRefresh(null);
    evictLegacyKeys();
  },

  /**
   * Subscribe to access-token changes. Invokes the listener once with the
   * current value, then on every subsequent change. Returns an unsubscribe
   * function.
   */
  subscribe(listener: (t: string | null) => void): () => void {
    listeners.add(listener);
    listener(accessToken);
    return () => { listeners.delete(listener); };
  },
};
