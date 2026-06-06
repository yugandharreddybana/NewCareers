import { describe, it, expect, beforeEach } from 'vitest';
import {
  writePendingSignup,
  readPendingSignup,
  clearPendingSignup,
  hasPendingSignup,
} from './pendingSignup';

const consents = {
  termsAccepted: true,
  aiProcessingAccepted: true,
  marketingAccepted: false,
  analyticsAccepted: false,
};

describe('pendingSignup', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips credentials and consents in sessionStorage', () => {
    writePendingSignup({ email: 'a@b.test', password: 'N0tPwned!1234Aa', name: 'Jane', consents });
    expect(hasPendingSignup()).toBe(true);
    expect(readPendingSignup()).toEqual({
      email: 'a@b.test',
      password: 'N0tPwned!1234Aa',
      name: 'Jane',
      consents,
    });
    clearPendingSignup();
    expect(hasPendingSignup()).toBe(false);
  });

  it('rejects invalid stored payload', () => {
    sessionStorage.setItem('co_pending_signup_v1', JSON.stringify({ email: '', password: 'x' }));
    expect(readPendingSignup()).toBeNull();
  });

  it('rejects payload missing consents', () => {
    sessionStorage.setItem(
      'co_pending_signup_v1',
      JSON.stringify({ email: 'a@b.test', password: 'N0tPwned!1234Aa' }),
    );
    expect(readPendingSignup()).toBeNull();
  });
});
