import { isAxiosError } from 'axios';
import { isApiError } from '@/types';

/** Phrases safe to show when returned by our own validation layers (never third-party / stack traces). */
const SAFE_USER_PHRASE_PREFIXES = [
  'enter the',
  'upload your',
  'passwords do not match',
  'you must accept',
  'ai processing consent',
  'complete the security',
  'choose a',
  'please enter',
  'too many requests',
  'wait a moment',
  'matching is taking longer',
  'matching could not complete',
  'we could not detect',
] as const;

function isSafeUserPhrase(msg: string): boolean {
  const lower = msg.trim().toLowerCase();
  if (!lower || lower.length > 200) return false;
  if (isTechnicalHttpMessage(lower)) return false;
  if (/sql|exception|stack|undefined|null pointer|hibp|breach/i.test(lower)) return false;
  return SAFE_USER_PHRASE_PREFIXES.some(prefix => lower.startsWith(prefix) || lower.includes(prefix));
}

function statusFallback(status: number | undefined, fallback: string): string {
  if (status === 401 || status === 403) {
    return 'Your session may have expired. Please sign in again.';
  }
  if (status === 404) {
    return 'This feature is temporarily unavailable. Refresh the page and try again.';
  }
  if (status === 409) {
    return 'This action could not be completed because of a conflict. Please refresh and try again.';
  }
  if (status === 429) {
    return 'Too many requests — wait a moment and try again.';
  }
  if (status === 503) {
    return 'Service temporarily unavailable. Please try again shortly.';
  }
  if (status && status >= 500) {
    return 'Our servers had trouble completing that request. Please try again shortly.';
  }
  return fallback;
}

function readStatus(error: unknown): number | undefined {
  if (isApiError(error)) return error.status;
  if (isAxiosError(error)) return error.response?.status;
  return undefined;
}

/** User-safe message — never raw HTTP codes or internal server diagnostics. */
export function getUserFacingErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const status = readStatus(error);

  if (isApiError(error)) {
    if (isSafeUserPhrase(error.normalizedMessage)) {
      return error.normalizedMessage;
    }
    return statusFallback(status, fallback);
  }

  if (isAxiosError(error)) {
    const normalized = (error as { normalizedMessage?: string }).normalizedMessage;
    if (normalized && isSafeUserPhrase(normalized)) {
      return normalized;
    }
    const body = error.response?.data;
    if (body && typeof body === 'object') {
      const msg = (body as { error?: string; message?: string }).error
        ?? (body as { message?: string }).message;
      if (msg && isSafeUserPhrase(msg)) return msg;
    }
    if (error.code === 'ERR_NETWORK' || !error.response) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    return statusFallback(status, fallback);
  }

  if (error instanceof Error && error.message && isSafeUserPhrase(error.message)) {
    return error.message;
  }

  return fallback;
}

function isTechnicalHttpMessage(msg: string): boolean {
  const t = msg.trim();
  if (/^\d{3}$/.test(t)) return true;
  if (/request failed with status code \d{3}/i.test(t)) return true;
  if (/^HTTP \d{3}/i.test(t)) return true;
  if (t === 'not found' || t === 'network error') return true;
  return false;
}
