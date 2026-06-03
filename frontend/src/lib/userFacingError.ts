import { isAxiosError } from 'axios';

/** User-safe message — never raw HTTP status codes. */
export function getUserFacingErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isAxiosError(error)) {
    const normalized = (error as { normalizedMessage?: string }).normalizedMessage;
    if (normalized && !isTechnicalHttpMessage(normalized)) {
      return normalized;
    }
    const body = error.response?.data;
    if (body && typeof body === 'object') {
      const msg = (body as { error?: string; message?: string }).error
        ?? (body as { message?: string }).message;
      if (msg && !isTechnicalHttpMessage(msg)) return msg;
    }
    const status = error.response?.status;
    if (status === 404) {
      return 'This feature is temporarily unavailable. Refresh the page and try again.';
    }
    if (status === 401 || status === 403) {
      return 'Your session may have expired. Please sign in again.';
    }
    if (status === 429) {
      return 'Too many requests — wait a moment and try again.';
    }
    if (status && status >= 500) {
      return 'Our servers had trouble completing that request. Please try again shortly.';
    }
    if (error.code === 'ERR_NETWORK' || !error.response) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    return fallback;
  }
  if (error instanceof Error && error.message && !isTechnicalHttpMessage(error.message)) {
    return error.message;
  }
  return fallback;
}

function isTechnicalHttpMessage(msg: string): boolean {
  const t = msg.trim();
  if (/^\d{3}$/.test(t)) return true;
  if (/request failed with status code \d{3}/i.test(t)) return true;
  if (/^HTTP \d{3}/i.test(t)) return true;
  if (t === 'Not Found' || t === 'Network Error') return true;
  return false;
}
