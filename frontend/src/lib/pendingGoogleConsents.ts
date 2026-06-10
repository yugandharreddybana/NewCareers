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

/** Both mandatory signup consents must be accepted before Google fast-path sign-in. */
export function hasCompleteGoogleConsents(
  consents: SignupConsents | null | undefined,
): boolean {
  return Boolean(consents?.termsAccepted && consents?.aiProcessingAccepted);
}

export type GoogleLoginConsentDecision =
  | { kind: 'fast_path'; consents: SignupConsents }
  | { kind: 'show_sheet'; clearStale: boolean };

/** Login Google button: fast-path only when both mandatory consents are stored. */
export function resolveGoogleLoginConsent(
  pending: SignupConsents | null,
): GoogleLoginConsentDecision {
  if (hasCompleteGoogleConsents(pending)) {
    return { kind: 'fast_path', consents: pending! };
  }
  return { kind: 'show_sheet', clearStale: Boolean(pending) };
}

/** Safe consents for API — never use stale partial sessionStorage values. */
export function resolveGoogleSignInConsents(
  explicit?: SignupConsents,
): SignupConsents | undefined {
  if (explicit) return explicit;
  const stored = readPendingGoogleConsents();
  return hasCompleteGoogleConsents(stored) ? stored! : undefined;
}
