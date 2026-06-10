/**
 * Shared CSRF + rate-limit middleware for /api/v1 and legacy /api/billing mounts.
 */
import type { Request, Response, NextFunction } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { verifySessionToken } from './jwtVerification.js';

export const CSRF_COOKIE = 'co_csrf';
const SESSION_COOKIE = process.env.COOKIE_NAME || 'co_session';

const CSRF_EXEMPT_SUFFIXES = ['/billing/webhook'];

export function isCsrfExempt(req: Request): boolean {
  const path = (req.originalUrl ?? req.url ?? req.path ?? '').split('?')[0] ?? '';
  return CSRF_EXEMPT_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

export function strictCsrfRequired(): boolean {
  const env = process.env.NODE_ENV ?? 'development';
  return env === 'production' || env === 'staging';
}

export function createCsrfProtection() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      next();
      return;
    }

    if (isCsrfExempt(req)) {
      next();
      return;
    }

    const cookieToken = (req.cookies[CSRF_COOKIE] as string | undefined) || req.issuedCsrfToken;
    if (!cookieToken) {
      res.status(403).json({ error: 'CSRF validation failed: Token missing' });
      return;
    }

    if (strictCsrfRequired()) {
      const headerToken = req.headers['x-csrf-token'];
      if (!headerToken || String(headerToken) !== cookieToken) {
        res.status(403).json({ error: 'CSRF validation failed: Token mismatch' });
        return;
      }
      next();
      return;
    }

    const xrw = req.headers['x-requested-with'];
    if (String(xrw ?? '').toLowerCase() === 'xmlhttprequest') {
      next();
      return;
    }

    const headerToken = req.headers['x-csrf-token'];
    if (headerToken && String(headerToken) !== cookieToken) {
      res.status(403).json({ error: 'CSRF validation failed: Token mismatch' });
      return;
    }

    next();
  };
}

export function resolveRateLimitKey(req: Request): string {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.substring(7);
      const payload = verifySessionToken(token);
      if (payload?.sub) return `user:${payload.sub}`;
    }
  } catch { /* fall through */ }

  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (cookieToken) {
    try {
      const payload = verifySessionToken(cookieToken);
      if (payload?.sub) return `user:${payload.sub}`;
    } catch { /* fall through */ }
  }

  return ipKeyGenerator(req.ip ?? 'unknown');
}

export function createGlobalApiRateLimit() {
  return rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveRateLimitKey(req),
  });
}

export function createBillingWebhookRateLimit() {
  const isProd = process.env.NODE_ENV === 'production';
  return rateLimit({
    windowMs: 60_000,
    max: isProd ? 120 : 2_000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many webhook requests.' },
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
  });
}
