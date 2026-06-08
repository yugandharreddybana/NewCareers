import { describe, expect, it } from 'vitest';
import {
  GENERIC_DUPLICATE_EMAIL_ERROR,
  GENERIC_SECURITY_ERROR,
  GENERIC_SIGNUP_ERROR,
  GENERIC_WEAK_PASSWORD,
  mapSignupIntentError,
} from './authErrors';

describe('mapSignupIntentError', () => {
  it('maps 409 to duplicate email message', () => {
    expect(mapSignupIntentError({ status: 409, normalizedMessage: 'conflict' })).toBe(
      GENERIC_DUPLICATE_EMAIL_ERROR,
    );
  });

  it('maps password-related 400 to weak password message', () => {
    expect(
      mapSignupIntentError({
        status: 400,
        normalizedMessage: 'This password is not secure enough.',
      }),
    ).toBe(GENERIC_WEAK_PASSWORD);
  });

  it('maps captcha-related 400 to security message', () => {
    expect(
      mapSignupIntentError({
        status: 400,
        normalizedMessage: 'Security verification failed.',
      }),
    ).toBe(GENERIC_SECURITY_ERROR);
  });

  it('maps consent-related 400 to generic signup message', () => {
    expect(
      mapSignupIntentError({
        status: 400,
        normalizedMessage: 'AI processing consent is required.',
      }),
    ).toBe(GENERIC_SIGNUP_ERROR);
  });
});
