import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hasAnalyticsConsent,
  shouldShowCookieBanner,
  writeAnalyticsConsent,
  syncLocalAnalyticsConsentToBackend,
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_VERSION,
} from './cookieConsent';
import { consentApi } from '@/services/consentApi';
import { tokenStore } from '@/lib/tokenStore';

vi.mock('@/services/consentApi', () => ({
  consentApi: {
    getConsents: vi.fn(),
    updateConsent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/tokenStore', () => ({
  tokenStore: {
    hasAccess: vi.fn(),
    hasRefreshOrCookie: vi.fn(),
  },
}));

describe('cookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(tokenStore.hasAccess).mockReturnValue(false);
    vi.mocked(tokenStore.hasRefreshOrCookie).mockReturnValue(false);
  });

  it('shows banner until a choice is recorded', () => {
    expect(shouldShowCookieBanner()).toBe(true);
    writeAnalyticsConsent(false);
    expect(shouldShowCookieBanner()).toBe(false);
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('persists analytics acceptance', () => {
    writeAnalyticsConsent(true);
    expect(hasAnalyticsConsent()).toBe(true);
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).version).toBe(COOKIE_CONSENT_VERSION);
  });

  it('syncLocalAnalyticsConsentToBackend skips when no local choice', async () => {
    vi.mocked(tokenStore.hasAccess).mockReturnValue(true);
    await syncLocalAnalyticsConsentToBackend();
    expect(consentApi.updateConsent).not.toHaveBeenCalled();
  });

  it('syncLocalAnalyticsConsentToBackend skips when not authenticated', async () => {
    writeAnalyticsConsent(true);
    await syncLocalAnalyticsConsentToBackend();
    expect(consentApi.updateConsent).not.toHaveBeenCalled();
  });

  it('syncLocalAnalyticsConsentToBackend posts ANALYTICS when choice exists and session active', async () => {
    writeAnalyticsConsent(true);
    vi.mocked(tokenStore.hasAccess).mockReturnValue(true);
    await syncLocalAnalyticsConsentToBackend();
    expect(consentApi.updateConsent).toHaveBeenCalledWith('ANALYTICS', true);
  });

  it('syncLocalAnalyticsConsentToBackend posts rejection when analytics declined', async () => {
    writeAnalyticsConsent(false);
    vi.mocked(tokenStore.hasRefreshOrCookie).mockReturnValue(true);
    await syncLocalAnalyticsConsentToBackend();
    expect(consentApi.updateConsent).toHaveBeenCalledWith('ANALYTICS', false);
  });
});
