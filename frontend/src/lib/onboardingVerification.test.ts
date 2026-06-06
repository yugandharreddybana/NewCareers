import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  writeOnboardingVerification,
  readOnboardingVerification,
  clearOnboardingVerification,
} from './onboardingVerification';

describe('onboardingVerification', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes and reads verification session for matching email', () => {
    writeOnboardingVerification('abc-123', 'User@Example.com');
    const session = readOnboardingVerification('user@example.com');
    expect(session).toEqual({
      verificationId: 'abc-123',
      email: 'user@example.com',
      expiresAt: Date.parse('2026-06-05T12:20:00Z'),
    });
  });

  it('returns null when email does not match', () => {
    writeOnboardingVerification('abc-123', 'a@example.com');
    expect(readOnboardingVerification('b@example.com')).toBeNull();
  });

  it('expires session after TTL', () => {
    writeOnboardingVerification('abc-123', 'a@example.com');
    vi.setSystemTime(new Date('2026-06-05T12:21:00Z'));
    expect(readOnboardingVerification('a@example.com')).toBeNull();
  });

  it('clear removes stored session', () => {
    writeOnboardingVerification('abc-123', 'a@example.com');
    clearOnboardingVerification();
    expect(readOnboardingVerification()).toBeNull();
  });
});
