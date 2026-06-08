import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  writeOnboardingVerification,
  readOnboardingVerification,
  clearOnboardingVerification,
} from './onboardingVerification';

const INTENT_ID = '22222222-2222-4222-8222-222222222222';

describe('onboardingVerification', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes and reads verification session for matching email and intent', () => {
    writeOnboardingVerification('abc-123', 'User@Example.com', INTENT_ID);
    const session = readOnboardingVerification('user@example.com', INTENT_ID);
    expect(session).toEqual({
      verificationId: 'abc-123',
      email: 'user@example.com',
      signupIntentId: INTENT_ID,
      expiresAt: Date.parse('2026-06-05T12:15:00Z'),
    });
  });

  it('returns null when intent id does not match', () => {
    writeOnboardingVerification('abc-123', 'a@example.com', INTENT_ID);
    expect(readOnboardingVerification('a@example.com', 'other-intent')).toBeNull();
  });

  it('expires session after TTL', () => {
    writeOnboardingVerification('abc-123', 'a@example.com', INTENT_ID);
    vi.setSystemTime(new Date('2026-06-05T12:16:00Z'));
    expect(readOnboardingVerification('a@example.com', INTENT_ID)).toBeNull();
  });

  it('clear removes stored session', () => {
    writeOnboardingVerification('abc-123', 'a@example.com', INTENT_ID);
    clearOnboardingVerification();
    expect(readOnboardingVerification()).toBeNull();
  });
});
