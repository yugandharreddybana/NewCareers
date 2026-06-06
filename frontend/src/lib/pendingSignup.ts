/**
 * Deferred email signup — credentials collected on /signup, account created on
 * onboarding finish ("Find my jobs"). Stored in sessionStorage (tab-scoped).
 */
export interface SignupConsents {
  termsAccepted: boolean;
  aiProcessingAccepted: boolean;
  marketingAccepted: boolean;
  analyticsAccepted: boolean;
}

export interface PendingSignup {
  email: string;
  password: string;
  /** Optional prefill from signup form; onboarding full name wins at register time. */
  name?: string;
  consents: SignupConsents;
}

const KEY = 'co_pending_signup_v1';

export function hasPendingSignup(): boolean {
  return readPendingSignup() !== null;
}

export function readPendingSignup(): PendingSignup | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    if (
      typeof parsed.email === 'string' &&
      parsed.email.length > 0 &&
      typeof parsed.password === 'string' &&
      parsed.password.length >= 8 &&
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
}
