/**
 * tokenStore.ts — single source of truth for access tokens.
 *
 * Security model:
 *   - Access token  → in-memory only (zero persistence ⇒ zero XSS surface).
 *   - Refresh token → HttpOnly `co_refresh` cookie only (never sessionStorage).
 *
 * On tab refresh the axios interceptor calls /auth/refresh with credentials;
 * middleware reads the HttpOnly refresh cookie and rotates tokens.
 */

const REFRESH_VIA_COOKIE_KEY = 'co_refresh_cookie_v2';
const LEGACY_KEYS = ['co_token', 'co_refresh', 'co_refresh_v2', 'co_user'] as const;

let accessToken: string | null = null;
/** True when a refresh token may exist in the HttpOnly cookie. */
let refreshViaCookie = false;
let legacyEvicted = false;

const listeners = new Set<(t: string | null) => void>();

const safeSession = {
  get(key: string): string | null {
    try { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key); }
    catch { return null; }
  },
  set(key: string, value: string): void {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value); }
    catch { /* ignore */ }
  },
  remove(key: string): void {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key); }
    catch { /* ignore */ }
  },
};

function evictLegacyKeys(): void {
  if (typeof window === 'undefined') return;
  for (const k of LEGACY_KEYS) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    try { sessionStorage.removeItem(k); } catch { /* ignore */ }
  }
}

function ensureLegacyEvicted(): void {
  if (legacyEvicted) return;
  evictLegacyKeys();
  legacyEvicted = true;
}

function clearCookieRefreshFlag(): void {
  safeSession.remove(REFRESH_VIA_COOKIE_KEY);
}

function hydrateCookieRefreshFlag(): void {
  refreshViaCookie = safeSession.get(REFRESH_VIA_COOKIE_KEY) === '1';
}

hydrateCookieRefreshFlag();

function notify(): void {
  for (const listener of listeners) listener(accessToken);
}

export const tokenStore = {
  getAccess(): string | null { return accessToken; },

  setAccess(token: string | null): void {
    ensureLegacyEvicted();
    accessToken = token && token.length > 0 ? token : null;
    notify();
  },

  hasAccess(): boolean { return accessToken !== null; },

  /** @deprecated Refresh tokens are HttpOnly cookies only. */
  getRefresh(): string | null { return null; },

  /** @deprecated Refresh tokens are HttpOnly cookies only. */
  setRefresh(_token: string | null): void {
    ensureLegacyEvicted();
  },

  hasRefresh(): boolean { return false; },

  hasRefreshOrCookie(): boolean { return refreshViaCookie; },

  setRefreshViaCookie(enabled: boolean): void {
    ensureLegacyEvicted();
    refreshViaCookie = enabled;
    if (enabled) safeSession.set(REFRESH_VIA_COOKIE_KEY, '1');
    else clearCookieRefreshFlag();
  },

  usesCookieRefresh(): boolean { return refreshViaCookie; },

  /** After login / signup / silent refresh — access in memory, refresh in cookie. */
  set(access: string, _refresh?: string): void {
    ensureLegacyEvicted();
    this.setAccessOnly(access);
  },

  setAccessOnly(access: string): void {
    ensureLegacyEvicted();
    refreshViaCookie = true;
    safeSession.set(REFRESH_VIA_COOKIE_KEY, '1');
    safeSession.remove('co_refresh_v2');
    this.setAccess(access);
  },

  clear(): void {
    ensureLegacyEvicted();
    refreshViaCookie = false;
    clearCookieRefreshFlag();
    this.setAccess(null);
    evictLegacyKeys();
  },

  subscribe(listener: (t: string | null) => void): () => void {
    listeners.add(listener);
    if (typeof window !== 'undefined') {
      listener(accessToken);
    }
    return () => { listeners.delete(listener); };
  },
};
