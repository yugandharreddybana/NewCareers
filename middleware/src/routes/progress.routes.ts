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
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const proxy = createJavaRouteProxy('/progress', {
  errorMessage: 'Progress service temporarily unavailable.',
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
