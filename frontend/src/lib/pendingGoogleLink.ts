/**
 * Persists Google link step-up idToken across refresh (tab-scoped).
 */
const KEY = 'co_google_link_v1';

export function writePendingGoogleLink(idToken: string): void {
  sessionStorage.setItem(KEY, idToken);
}

export function readPendingGoogleLink(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw?.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function clearPendingGoogleLink(): void {
  sessionStorage.removeItem(KEY);
}
