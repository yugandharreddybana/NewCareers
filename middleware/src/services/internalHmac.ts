import crypto from 'crypto';

export const TIMESTAMP_HEADER = 'X-Timestamp';
export const SIGNATURE_HEADER = 'X-Signature';

/** @deprecated INTERNAL_TRUST_SECRET — use APP_INTERNAL_SECRET; alias removed in a future release */
export function getInternalSecret(): string | undefined {
  return process.env.APP_INTERNAL_SECRET || process.env.INTERNAL_TRUST_SECRET;
}

export function bodyForSigning(data: unknown): string {
  if (data === undefined || data === null) return '';
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return JSON.stringify(data);
}

/**
 * Signs an internal middleware → Java request.
 * Payload: `${timestamp}${METHOD}${path}${body}` (UTF-8, no delimiters).
 */
export function signInternalRequest(
  method: string,
  path: string,
  body: string,
  secret = getInternalSecret(),
): { timestamp: string; signature: string } | null {
  if (!secret || secret.length < 32) return null;
  const timestamp = String(Date.now());
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return { timestamp, signature };
}
