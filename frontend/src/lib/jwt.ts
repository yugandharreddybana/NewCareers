/** Best-effort JWT expiry check (no signature verification — client clock only). */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const exp = decodeJwtExp(token);
  if (exp == null) return false;
  return Date.now() >= (exp - skewSeconds) * 1000;
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split('.');
  const payloadPart = parts[1];
  if (!payloadPart) return null;
  try {
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}
