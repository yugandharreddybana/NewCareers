/**
 * progress.routes.ts — weekly summary, streaks, history, activity
 *
 * Fixed:
 *  - Standardised to authGuard (was using verifyToken from auth.ts — same function,
 *    but inconsistent with every other route file in this codebase)
 *  - Added proxyTimeout + timeout (was the only route file missing them, risking
 *    hung requests on a slow Java backend)
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authGuard } from '../authGuard.js';

const router = express.Router();
const BACKEND_URL = process.env.JAVA_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080';

const proxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: {
    error: (err, _req, res) => {
      console.error('[progress proxy error]', err.message);
      res.status(502).json({ error: 'Progress service temporarily unavailable.' });
    },
  },
});

// GET  /api/progress/weekly-summary   → weekly stats
router.get('/weekly-summary', authGuard, proxy);

// GET  /api/progress/streaks          → current streaks
router.get('/streaks',        authGuard, proxy);

// GET  /api/progress/history?weeks=N  → multi-week chart data
router.get('/history',        authGuard, proxy);

// GET  /api/progress/full             → history + streak in one round-trip
router.get('/full',           authGuard, proxy);

// POST /api/progress/activity         → record daily activity + streak update
router.post('/activity',      authGuard, proxy);

export default router;
