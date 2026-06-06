/**
 * Analytics routes — proxies to Java backend with X-User-Id injected from JWT.
 *
 * GET /api/v1/analytics/summary       — weekly stats + skill usage
 * GET /api/v1/analytics/funnel        — application pipeline counts per kanban stage
 * GET /api/v1/analytics/time-series   — weekly trend data for charts
 * GET /api/v1/analytics/permits/**    — Irish employment permit intelligence
 */

import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const javaProxy = createJavaRouteProxy('/analytics', {
  errorMessage: 'Analytics backend unavailable',
});

const permitProxy = createJavaRouteProxy('/analytics/permits', {
  errorMessage: 'Permit analytics backend unavailable',
});

// Personal job-search analytics (authenticated)
router.get('/summary', authGuard, javaProxy);
router.get('/funnel', authGuard, javaProxy);
router.get('/time-series', authGuard, javaProxy);

// Employment permit analytics (authenticated — matches SecurityConfig .authenticated())
router.use('/permits', authGuard, permitProxy);

export default router;
