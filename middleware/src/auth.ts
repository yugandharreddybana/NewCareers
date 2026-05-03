/**
 * auth.ts — re-exports from authGuard for backwards compatibility.
 *
 * All actual JWT logic lives in authGuard.ts.
 * Route files that import from './auth.js' will continue to work.
 */
export { authGuard, verifyToken, requireRole } from './authGuard.js';
