/**
 * auth.ts — re-exports from authGuard for backwards compatibility.
 *
 * G9 note (Batch 7d): this file is NOT dead code — it is a deliberate
 * backwards-compat shim so any route file that imports from './auth.js'
 * continues to work without changes. All actual JWT logic lives in
 * authGuard.ts. Do NOT delete this file unless all imports have been
 * migrated to import directly from './authGuard.js'.
 */
export { authGuard, verifyToken, requireRole } from './authGuard.js';
