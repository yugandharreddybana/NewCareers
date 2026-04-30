/**
 * Section 5 — Task 48
 * Analytics routes — proxies to Java backend with X-User-Id injected from JWT.
 *
 * GET /api/analytics/summary  — weekly stats + skill usage
 * GET /api/analytics/funnel   — application pipeline counts per kanban stage
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authGuard } from '../middleware/authGuard.js';

const router = express.Router();
const JAVA   = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  on: {
    error: (err, _req, res) => {
      res.status(502).json({ error: 'Analytics backend unavailable', details: err.message });
    },
  },
});

// GET /api/analytics/summary
router.get('/summary', authGuard, javaProxy);

// GET /api/analytics/funnel
router.get('/funnel', authGuard, javaProxy);

export default router;
