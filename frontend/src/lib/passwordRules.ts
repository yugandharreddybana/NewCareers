/** Mirrors backend SignupRequest / VerifyOtpRequest password validation. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

export function isPasswordComplexityValid(password: string): boolean {
  return PASSWORD_PATTERN.test(password);
}

export function passwordComplexityHint(): string {
  return 'Use at least 8 characters with upper-case, lower-case, and a number.';
}

export type PasswordStrengthLabel = '' | 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';

export interface PasswordStrength {
  label: PasswordStrengthLabel;
  acceptable: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { label: '', acceptable: false };
  if (password.length < PASSWORD_MIN_LENGTH) return { label: 'Too short', acceptable: false };
  if (!isPasswordComplexityValid(password)) return { label: 'Weak', acceptable: false };

  let score = 0;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  if (score <= 1) return { label: 'Fair', acceptable: true };
  if (score === 2) return { label: 'Good', acceptable: true };
  return { label: 'Strong', acceptable: true };
}
