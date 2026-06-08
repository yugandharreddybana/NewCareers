import { isAxiosError } from 'axios';
import { isApiError } from '@/types';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';

export const GENERIC_LOGIN_ERROR = 'Invalid email or password.';
export const GENERIC_GOOGLE_ERROR = 'Google sign-in failed. Please try again.';
export const GENERIC_SIGNUP_ERROR = 'Could not continue. Please try again.';
export const GENERIC_DUPLICATE_EMAIL_ERROR =
  'An account may already exist for this email. Try signing in or use a different email.';
export const GENERIC_OTP_ERROR = 'Invalid code.';
export const GENERIC_OTP_SEND_ERROR = 'Unable to send code. Please try again.';
export const GENERIC_SECURITY_ERROR = 'Security verification failed. Please try again.';
export const GENERIC_FORGOT_SUCCESS =
  'If that email exists in our system, we have sent a reset code.';
export const GENERIC_RESET_ERROR = 'Unable to reset password. Please try again.';
export const GENERIC_ONBOARDING_SIGNUP_ERROR =
  'Could not create your account. Please try again.';
export const GENERIC_ONBOARDING_PROFILE_ERROR =
  'Could not save your profile. Please try again.';
export const GENERIC_ONBOARDING_MATCH_ERROR =
  'Matching could not complete. Your profile is saved — try again or continue to the dashboard.';
export const GENERIC_CV_PARSE_ERROR =
  'Could not read your CV. Please try again or upload a different file.';
export const GENERIC_WEAK_PASSWORD =
  'This password is not secure enough. Please choose a different password.';
export const GENERIC_SERVICE_UNAVAILABLE =
  'Service temporarily unavailable. Please try again shortly.';

function isDuplicateEmailError(err: unknown): boolean {
  if (isAxiosError(err) && err.response?.status === 409) return true;
  if (isApiError(err) && err.status === 409) return true;
  return false;
}

function signupIntent400Message(err: unknown): string {
  const raw = isApiError(err)
    ? err.normalizedMessage
    : isAxiosError(err)
      ? ((err as { normalizedMessage?: string }).normalizedMessage
        ?? (err.response?.data as { message?: string; error?: string } | undefined)?.message
        ?? (err.response?.data as { error?: string } | undefined)?.error)
      : undefined;
  const msg = (raw ?? '').toLowerCase();
  if (msg.includes('password') || msg.includes('secure') || msg.includes('pwned')) {
    return GENERIC_WEAK_PASSWORD;
  }
  if (msg.includes('security') || msg.includes('captcha') || msg.includes('recaptcha')) {
    return GENERIC_SECURITY_ERROR;
  }
  if (msg.includes('terms') || msg.includes('consent') || msg.includes('ai processing')) {
    return GENERIC_SIGNUP_ERROR;
  }
  return GENERIC_SIGNUP_ERROR;
}

/** Maps signup-intent API failures to safe, user-facing copy. */
export function mapSignupIntentError(err: unknown): string {
  if (isDuplicateEmailError(err)) return GENERIC_DUPLICATE_EMAIL_ERROR;
  const status = isApiError(err) ? err.status : isAxiosError(err) ? err.response?.status : undefined;
  if (status === 503) return GENERIC_SERVICE_UNAVAILABLE;
  if (status === 400) return signupIntent400Message(err);
  if (status === 429) {
    return getUserFacingErrorMessage(err, 'Too many attempts. Please wait and try again.');
  }
  return GENERIC_SIGNUP_ERROR;
}
