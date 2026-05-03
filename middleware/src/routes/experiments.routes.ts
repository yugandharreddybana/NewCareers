/**
 * experiments.routes.ts — A/B experiment variant + admin proxy routes
 *
 * User-facing endpoints read active experiment variants.
 * Admin endpoints require ADMIN role for experiment creation and management.
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken, requireRole } from '../auth.js';

const router = express.Router();
const proxy = createProxyMiddleware({
  target: process.env.BACKEND_URL || 'http://localhost:8080',
  changeOrigin: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: { error: (_e, _r, res) => res.status(502).json({ error: 'Experiment service unavailable.' }) },
});

// ── User-facing variant endpoints ──────────────────────────────────────────
router.get('/variants',       verifyToken, proxy);   // load all active variants on boot
router.get('/variant/:key',   verifyToken, proxy);   // single variant lookup

// ── Admin endpoints — require ADMIN role ───────────────────────────────────
router.get('/admin/results',      verifyToken, requireRole('ADMIN'), proxy);   // results dashboard
router.post('/admin',             verifyToken, requireRole('ADMIN'), proxy);   // create experiment
router.patch('/admin/:id/status', verifyToken, requireRole('ADMIN'), proxy);   // toggle status

export default router;
