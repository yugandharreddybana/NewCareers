/**
 * Deferred email signup — credentials stored server-side as signup intent.
 * sessionStorage holds intent id + email only (no password).
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
}

const KEY = 'co_pending_signup_v2';
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
    if (
      isValidSignupIntentId(parsed.signupIntentId) &&
      typeof parsed.email === 'string' &&
      parsed.email.length > 0 &&
      parsed.consents &&
      typeof parsed.consents.termsAccepted === 'boolean'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writePendingSignup(data: PendingSignup): void {
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function clearPendingSignup(): void {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem('co_pending_signup_v1');
}
