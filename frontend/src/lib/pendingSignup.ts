/**
 * Deferred email signup. Credentials are stored server-side as a signup intent.
 * sessionStorage holds intent id, email, consents, and a short client expiry only.
 */
export interface SignupConsents {
  termsAccepted: boolean;
  aiProcessingAccepted: boolean;
  marketingAccepted: boolean;
  analyticsAccepted: boolean;
}

export interface PendingSignup {
  signupIntentId: string;
  email: string;
  /** Optional prefill from signup form; onboarding full name wins at register time. */
  name?: string;
  consents: SignupConsents;
  expiresAt: string;
}

const KEY = 'co_pending_signup_v2';
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSignupIntentId(value: string | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

export function hasPendingSignup(): boolean {
  return readPendingSignup() !== null;
}

export function readPendingSignup(): PendingSignup | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    const expiresAtMs = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      clearPendingSignup();
      return null;
    }
    if (
      isValidSignupIntentId(parsed.signupIntentId) &&
      typeof parsed.email === 'string' &&
      parsed.email.length > 0 &&
      parsed.consents &&
      parsed.consents.termsAccepted === true &&
      parsed.consents.aiProcessingAccepted === true
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writePendingSignup(
  data: Omit<PendingSignup, 'expiresAt'> & { expiresAt?: string },
): void {
  const expiresAt = data.expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS).toISOString();
  sessionStorage.setItem(KEY, JSON.stringify({ ...data, expiresAt }));
}

export function clearPendingSignup(): void {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem('co_pending_signup_v1');
}
