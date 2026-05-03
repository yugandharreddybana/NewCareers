/**
 * authGuard.ts — unified JWT verification + role-based middleware
 *
 * Exports:
 *   authGuard   — verifies JWT from cookie or Authorization header, sets req.userId / req.email / req.role
 *   verifyToken — alias for authGuard (backwards-compatible)
 *   requireRole — factory returning middleware that enforces a specific role claim
 */
import jwt from 'jsonwebtoken';

const COOKIE = process.env.COOKIE_NAME || 'co_session';

interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Primary authentication middleware.
 * Reads JWT from cookie or Bearer header, verifies signature + expiry,
 * and attaches decoded claims to the request object.
 */
export function authGuard(req, res, next) {
  const token =
    (req.cookies && req.cookies[COOKIE]) ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is not set');
    return res.status(500).json({ error: 'Internal server error: Auth configuration missing' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    req.userId = payload.sub;
    req.email  = payload.email;
    req.role   = payload.role || 'USER';
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Session expired — please sign in again'
      : 'Invalid or expired session';
    res.status(401).json({ error: message });
  }
}

/**
 * Alias for backwards compatibility — older route files import verifyToken.
 */
export const verifyToken = authGuard;

/**
 * Role-based authorisation middleware factory.
 * Must be used AFTER authGuard so that req.role is available.
 *
 * @example
 *   router.get('/admin', authGuard, requireRole('ADMIN'), handler);
 */
export function requireRole(...allowedRoles: string[]) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.role)) {
      return res.status(403).json({ error: 'Forbidden — insufficient permissions' });
    }
    next();
  };
}
