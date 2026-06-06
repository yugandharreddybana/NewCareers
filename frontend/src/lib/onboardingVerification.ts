/**
 * Short-lived onboarding email verification handoff (OTP + CAPTCHA completed).
 */
export interface OnboardingVerificationSession {
  verificationId: string;
  email: string;
  expiresAt: number;
}

const KEY = 'co_onboarding_verification_v1';
const SESSION_TTL_MS = 20 * 60 * 1000;

export function writeOnboardingVerification(verificationId: string, email: string): void {
  const session: OnboardingVerificationSession = {
    verificationId,
    email: email.trim().toLowerCase(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function readOnboardingVerification(expectedEmail?: string): OnboardingVerificationSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingVerificationSession;
    if (
      typeof parsed.verificationId !== 'string' ||
      parsed.verificationId.length === 0 ||
      typeof parsed.email !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      clearOnboardingVerification();
      return null;
    }
    if (expectedEmail && parsed.email !== expectedEmail.trim().toLowerCase()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOnboardingVerification(): void {
  sessionStorage.removeItem(KEY);
}
