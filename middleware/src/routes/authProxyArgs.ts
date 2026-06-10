import type { Request } from 'express';
import { resolveClientIp } from '../trustedClientIp.js';

export function clientForwardHeaders(req: Request): Record<string, string> {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? { 'user-agent': ua } : {};
}

/** Forward args for POST /auth/refresh — mirrors login/register client binding. */
export function buildRefreshForwardArgs(req: Request, refreshToken: string) {
  return {
    method: 'POST' as const,
    path: '/auth/refresh',
    data: { refreshToken },
    ip: resolveClientIp(req),
    headers: clientForwardHeaders(req),
  };
}
