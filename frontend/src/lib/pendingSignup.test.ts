import { describe, it, expect, beforeEach } from 'vitest';
import {
  writePendingSignup,
  readPendingSignup,
  clearPendingSignup,
  hasPendingSignup,
  isValidSignupIntentId,
} from './pendingSignup';

const consents = {
  termsAccepted: true,
  aiProcessingAccepted: true,
  marketingAccepted: false,
  analyticsAccepted: false,
};

const INTENT_ID = '11111111-1111-4111-8111-111111111111';

describe('pendingSignup', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('validates signup intent UUID shape', () => {
    expect(isValidSignupIntentId(INTENT_ID)).toBe(true);
    expect(isValidSignupIntentId('not-a-uuid')).toBe(false);
  });

  it('round-trips intent id and consents in sessionStorage', () => {
    writePendingSignup({
      signupIntentId: INTENT_ID,
      email: 'a@b.test',
      name: 'Jane',
      consents,
    });
    expect(hasPendingSignup()).toBe(true);
    expect(readPendingSignup()).toEqual({
      signupIntentId: INTENT_ID,
      email: 'a@b.test',
      name: 'Jane',
      consents,
    });
    clearPendingSignup();
    expect(hasPendingSignup()).toBe(false);
  });

  it('rejects invalid stored payload', () => {
    sessionStorage.setItem(
      'co_pending_signup_v2',
      JSON.stringify({ signupIntentId: 'bad', email: 'a@b.test', consents }),
    );
    expect(readPendingSignup()).toBeNull();
  });
});
