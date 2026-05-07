/**
 * experiments.routes.ts — A/B experiment variant + admin proxy routes
 *
 * Fixed:
 *  - Standardised to authGuard from authGuard.ts (was importing verifyToken
 *    from auth.ts — functionally identical but inconsistent with all other routes)
 *
 * User-facing endpoints read active experiment variants.
 * Admin endpoints require ADMIN role for experiment creation and management.
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authGuard, requireRole } from '../authGuard.js';

const router = express.Router();
const proxy = createProxyMiddleware({
  target: process.env.JAVA_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080',
  changeOrigin: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: {
    error: (_e, _r, res) => {
      if (res && 'status' in res && typeof res.status === 'function') {
        res.status(502).json({ error: 'Experiment service unavailable.' });
      }
    },
  },
});

// ── User-facing variant endpoints ───────────────────────────────────────────
router.get('/variants',       authGuard, proxy);   // load all active variants on boot
router.get('/variant/:key',   authGuard, proxy);   // single variant lookup

// ── Admin endpoints — require ADMIN role ───────────────────────────────────
router.get('/admin/results',      authGuard, requireRole('ADMIN'), proxy);  // results dashboard
router.post('/admin',             authGuard, requireRole('ADMIN'), proxy);  // create experiment
router.patch('/admin/:id/status', authGuard, requireRole('ADMIN'), proxy);  // toggle status

export default router;
