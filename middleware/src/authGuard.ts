/**
 * authGuard.ts — unified JWT verification + role-based middleware
 *
 * F5 fix: added typed Express Request augmentation so that req.userId,
 * req.email, and req.role are known to TypeScript throughout the codebase.
 * Previously these were set dynamically on the untyped `req` object —
 * any route handler reading req.userId had an implicit `any` access.
 *
 * Exports:
 *   authGuard   — verifies JWT from cookie or Authorization header
 *   verifyToken — alias for authGuard (backwards compat)
 *   requireRole — factory for role-based access control
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifySessionToken } from './jwtVerification.js';

const COOKIE = process.env.COOKIE_NAME || 'co_session';
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

/** Opt-in only: fake dev user when no/invalid JWT (never default — breaks logout testing). */
function devAutoAuthEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.DEV_AUTO_AUTH === 'true';
}

function applyDevUser(req: Request): void {
  req.userId = DEV_USER_ID;
  req.email = 'dev@careerops.ie';
  req.role = 'ADMIN';

  const trustHeader = process.env.INTERNAL_TRUST_HEADER || 'X-Internal-User-Id';
  req.headers[trustHeader] = req.userId;
  req.headers[trustHeader.toLowerCase()] = req.userId;
  if (process.env.INTERNAL_TRUST_SECRET) {
    req.headers['X-Internal-Secret'] = process.env.INTERNAL_TRUST_SECRET;
    req.headers['x-internal-secret'] = process.env.INTERNAL_TRUST_SECRET;
  }
}

// F5 fix: augment Express Request so downstream route handlers are typed
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      email?: string;
      role?: string;
    }
  }
}

function readBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  const value = header.slice(7).trim();
  return value.length > 0 ? value : undefined;
}

function readCookieToken(req: Request): string | undefined {
  const value = req.cookies?.[COOKIE] as string | undefined;
  return value && value.length > 0 ? value : undefined;
}

export function authGuard(req: Request, res: Response, next: NextFunction): void {
  const bearer = readBearer(req);
  const cookie = readCookieToken(req);

  if (!bearer && !cookie) {
    if (devAutoAuthEnabled()) {
      applyDevUser(req);
      return next();
    }
    res.status(401).json({ error: 'Unauthorized — no token provided' });
    return;
  }

  if (!process.env.JWT_PUBLIC_KEY) {
    console.error('CRITICAL: JWT_PUBLIC_KEY environment variable is not set');
    res.status(500).json({ error: 'Internal server error: Auth configuration missing' });
    return;
  }

  const candidates = bearer && cookie && bearer !== cookie
    ? [bearer, cookie]
    : [bearer ?? cookie].filter((t): t is string => Boolean(t));

  let lastError: unknown;
  for (const token of candidates) {
    try {
      const payload = verifySessionToken(token);
      req.userId = payload.sub === 'dev-user-123' ? '00000000-0000-0000-0000-000000000001' : payload.sub;
      req.email  = payload.email;
      req.role   = payload.role ?? 'USER';

      const trustHeader = process.env.INTERNAL_TRUST_HEADER || 'X-Internal-User-Id';
      req.headers[trustHeader] = req.userId;
      req.headers[trustHeader.toLowerCase()] = req.userId;
      if (process.env.INTERNAL_TRUST_SECRET) {
        req.headers['X-Internal-Secret'] = process.env.INTERNAL_TRUST_SECRET;
        req.headers['x-internal-secret'] = process.env.INTERNAL_TRUST_SECRET;
      }

      return next();
    } catch (err) {
      lastError = err;
    }
  }

  if (devAutoAuthEnabled()) {
    applyDevUser(req);
    return next();
  }

  const err = lastError;
  const message = err instanceof jwt.TokenExpiredError
    ? 'Session expired — please sign in again'
    : 'Invalid or expired session';
  res.status(401).json({ error: message });
}

/** Backwards-compatible alias */
export const verifyToken = authGuard;

/**
 * Role-based authorisation middleware factory.
 * Must be used AFTER authGuard so that req.role is set.
 *
 * @example
 *   router.get('/admin', authGuard, requireRole('ADMIN'), handler);
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.role || !allowedRoles.includes(req.role)) {
      res.status(403).json({ error: 'Forbidden — insufficient permissions' });
      return;
    }
    next();
  };
}
