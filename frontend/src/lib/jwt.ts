/** Best-effort JWT expiry check (no signature verification — client clock only). */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const exp = decodeJwtExp(token);
  if (exp == null) return true;
  return Date.now() >= (exp - skewSeconds) * 1000;
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }
  throw new ReferenceError('No base64 decoder available');
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split('.');
  const payloadPart = parts[1];
  if (!payloadPart) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}
