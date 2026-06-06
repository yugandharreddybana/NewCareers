import { consentApi } from '@/services/consentApi';
import { tokenStore } from '@/lib/tokenStore';

export const COOKIE_CONSENT_KEY = 'co_cookie_consent_v1';
export const COOKIE_CONSENT_VERSION = 'v1.0';

export type CookieConsentChoice = 'accepted' | 'rejected' | null;

interface CookieConsentRecord {
  version: string;
  analytics: boolean;
  dismissed: boolean;
}

function parseLegacy(raw: string): CookieConsentRecord | null {
  if (raw === 'accepted') {
    return { version: COOKIE_CONSENT_VERSION, analytics: true, dismissed: true };
  }
  if (raw === 'rejected') {
    return { version: COOKIE_CONSENT_VERSION, analytics: false, dismissed: true };
  }
  return null;
}

function readRecord(): CookieConsentRecord | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const legacy = parseLegacy(raw);
    if (legacy) return legacy;
    const parsed = JSON.parse(raw) as CookieConsentRecord;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.dismissed !== 'boolean') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readAnalyticsConsent(): CookieConsentChoice {
  const record = readRecord();
  if (!record?.dismissed) return null;
  return record.analytics ? 'accepted' : 'rejected';
}

export function writeAnalyticsConsent(accepted: boolean): void {
  const record: CookieConsentRecord = {
    version: COOKIE_CONSENT_VERSION,
    analytics: accepted,
    dismissed: true,
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(record));
  } catch {
    /* ignore quota errors */
  }
}

export function shouldShowCookieBanner(): boolean {
  const record = readRecord();
  return !record?.dismissed || record.version !== COOKIE_CONSENT_VERSION;
}

export function hasAnalyticsConsent(): boolean {
  const record = readRecord();
  if (record?.dismissed && record.version === COOKIE_CONSENT_VERSION) {
    return record.analytics;
  }
  return false;
}

export async function resolveAnalyticsConsent(): Promise<boolean> {
  if (tokenStore.hasAccess() || tokenStore.hasRefreshOrCookie()) {
    try {
      const status = await consentApi.getConsents();
      return status.analytics.accepted;
    } catch {
      /* fall through */
    }
  }
  return hasAnalyticsConsent();
}

export async function persistAnalyticsChoice(accepted: boolean): Promise<void> {
  writeAnalyticsConsent(accepted);
  if (tokenStore.hasAccess() || tokenStore.hasRefreshOrCookie()) {
    try {
      await consentApi.updateConsent('ANALYTICS', accepted);
    } catch {
      /* local choice still applies */
    }
  }
  if (accepted) {
    const { initializeMonitoring } = await import('@/lib/monitoring');
    await initializeMonitoring();
  }
}

export async function syncLocalAnalyticsConsentToBackend(): Promise<void> {
  const choice = readAnalyticsConsent();
  if (choice === null) return;
  if (!tokenStore.hasAccess() && !tokenStore.hasRefreshOrCookie()) return;
  try {
    await consentApi.updateConsent('ANALYTICS', choice === 'accepted');
  } catch {
    /* non-fatal */
  }
}
