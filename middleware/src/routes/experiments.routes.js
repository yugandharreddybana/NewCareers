// Section 3.6 Tasks 76-80 — experiment variant + admin proxy routes
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const proxy = createProxyMiddleware({
  target: process.env.BACKEND_URL || 'http://localhost:8080',
  changeOrigin: true,
  on: { error: (_e, _r, res) => res.status(502).json({ error: 'Experiment service unavailable.' }) },
});

// User-facing variant endpoints
router.get('/variants',       verifyToken, proxy); // load all active variants on boot
router.get('/variant/:key',   verifyToken, proxy); // single variant lookup

// Admin endpoints (Tasks 79+80) — additional role check enforced at backend
router.get('/admin/results',  verifyToken, proxy); // Task 80 — results dashboard
router.post('/admin',         verifyToken, proxy); // Task 79 — create experiment
router.patch('/admin/:id/status', verifyToken, proxy); // Task 79 — toggle status

export default router;
