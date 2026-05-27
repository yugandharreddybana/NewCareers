/**
 * Section 5 — Task 48
 * Analytics routes — proxies to Java backend with X-User-Id injected from JWT.
 *
 * GET /api/analytics/summary  — weekly stats + skill usage
 * GET /api/analytics/funnel   — application pipeline counts per kanban stage
 */

import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const javaProxy = createJavaRouteProxy('/analytics', {
  errorMessage: 'Analytics backend unavailable',
});

// GET /api/analytics/summary
router.get('/summary', authGuard, javaProxy);

// GET /api/analytics/funnel
router.get('/funnel', authGuard, javaProxy);

export default router;
