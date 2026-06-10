import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingGoogleConsents,
  hasCompleteGoogleConsents,
  readPendingGoogleConsents,
  resolveGoogleLoginConsent,
  resolveGoogleSignInConsents,
  writePendingGoogleConsents,
} from '@/lib/pendingGoogleConsents';

const FULL_CONSENTS = {
  termsAccepted: true,
  aiProcessingAccepted: true,
  marketingAccepted: false,
  analyticsAccepted: false,
};

const STALE_PARTIAL = {
  termsAccepted: true,
  aiProcessingAccepted: false,
  marketingAccepted: false,
  analyticsAccepted: false,
};

describe('pendingGoogleConsents', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('hasCompleteGoogleConsents returns false when consents are missing', () => {
    expect(hasCompleteGoogleConsents(null)).toBe(false);
    expect(hasCompleteGoogleConsents(undefined)).toBe(false);
  });

  it('hasCompleteGoogleConsents returns false when only terms are accepted', () => {
    expect(hasCompleteGoogleConsents(STALE_PARTIAL)).toBe(false);
  });

  it('hasCompleteGoogleConsents returns true when terms and AI consent are accepted', () => {
    expect(hasCompleteGoogleConsents(FULL_CONSENTS)).toBe(true);
    writePendingGoogleConsents(FULL_CONSENTS);
    expect(hasCompleteGoogleConsents(readPendingGoogleConsents())).toBe(true);
  });

  it('clearPendingGoogleConsents removes stored consents', () => {
    writePendingGoogleConsents(FULL_CONSENTS);
    clearPendingGoogleConsents();
    expect(readPendingGoogleConsents()).toBeNull();
  });

  it('resolveGoogleLoginConsent fast-path requires both mandatory consents (LSA-T03)', () => {
    expect(resolveGoogleLoginConsent(null)).toEqual({ kind: 'show_sheet', clearStale: false });
    expect(resolveGoogleLoginConsent(STALE_PARTIAL)).toEqual({
      kind: 'show_sheet',
      clearStale: true,
    });
    expect(resolveGoogleLoginConsent(FULL_CONSENTS)).toEqual({
      kind: 'fast_path',
      consents: FULL_CONSENTS,
    });
  });

  it('resolveGoogleSignInConsents ignores stale partial sessionStorage', () => {
    writePendingGoogleConsents(STALE_PARTIAL);
    expect(resolveGoogleSignInConsents()).toBeUndefined();
    expect(resolveGoogleSignInConsents(FULL_CONSENTS)).toEqual(FULL_CONSENTS);
    writePendingGoogleConsents(FULL_CONSENTS);
    expect(resolveGoogleSignInConsents()).toEqual(FULL_CONSENTS);
  });
});
