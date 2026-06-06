/**
 * Consent choices for Google Sign-In — collected on /signup, passed to POST /auth/google.
 */
import type { SignupConsents } from '@/lib/pendingSignup';

const KEY = 'co_google_consents_v1';

export function writePendingGoogleConsents(consents: SignupConsents): void {
  sessionStorage.setItem(KEY, JSON.stringify(consents));
}

export function readPendingGoogleConsents(): SignupConsents | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupConsents;
    if (
      typeof parsed.termsAccepted === 'boolean' &&
      typeof parsed.aiProcessingAccepted === 'boolean' &&
      typeof parsed.marketingAccepted === 'boolean' &&
      typeof parsed.analyticsAccepted === 'boolean'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingGoogleConsents(): void {
  sessionStorage.removeItem(KEY);
}
