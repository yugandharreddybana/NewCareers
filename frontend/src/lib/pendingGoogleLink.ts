/**
 * Holds the Google link step-up id token only in tab memory.
 */
const LEGACY_KEY = 'co_google_link_v1';

let pendingIdToken: string | null = null;

export function writePendingGoogleLink(idToken: string): void {
  pendingIdToken = idToken;
  sessionStorage.removeItem(LEGACY_KEY);
}

export function readPendingGoogleLink(): string | null {
  return pendingIdToken?.trim() ? pendingIdToken : null;
}

export function clearPendingGoogleLink(): void {
  pendingIdToken = null;
  sessionStorage.removeItem(LEGACY_KEY);
}
