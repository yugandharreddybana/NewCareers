/**
 * Mirrors Java TrustedProxyIpResolver — honor X-Forwarded-For only when
 * TRUSTED_PROXY=true|1 or the immediate peer is loopback.
 */
import type { Request } from 'express';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function normalizeRemoteAddress(req: Request): string {
  const raw = req.socket?.remoteAddress ?? req.ip ?? '';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

export function trustForwardedFor(req: Request): boolean {
  const trusted = process.env.TRUSTED_PROXY;
  if (trusted === 'true' || trusted === '1') {
    return true;
  }
  const remote = normalizeRemoteAddress(req);
  return LOOPBACK.has(remote) || remote === '0:0:0:0:0:0:0:1';
}

export function resolveClientIp(req: Request): string | undefined {
  if (trustForwardedFor(req)) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() || undefined;
    }
  }
  const remote = req.socket?.remoteAddress ?? req.ip;
  return typeof remote === 'string' && remote.length > 0 ? remote : undefined;
}
