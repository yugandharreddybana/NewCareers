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

const COOKIE = process.env.COOKIE_NAME || 'co_session';

interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
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

export function authGuard(req: Request, res: Response, next: NextFunction): void {
  const token =
    (req.cookies?.[COOKIE] as string | undefined) ??
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized — no token provided' });
    return;
  }

  if (!process.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is not set');
    res.status(500).json({ error: 'Internal server error: Auth configuration missing' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    req.userId = payload.sub;
    req.email  = payload.email;
    req.role   = payload.role ?? 'USER';
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Session expired — please sign in again'
      : 'Invalid or expired session';
    res.status(401).json({ error: message });
  }
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
