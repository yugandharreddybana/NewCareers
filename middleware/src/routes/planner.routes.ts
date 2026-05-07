/**
 * planner.routes.ts — application planner: tasks, deadlines, AI generation
 *
 * Covers all endpoints consumed by frontend/src/api/plannerApi.ts:
 *   GET    /upcoming
 *   GET    /jobs/:userJobId/tasks
 *   POST   /jobs/:userJobId/tasks/generate
 *   PATCH  /tasks/:taskId/complete
 *   GET    /jobs/:userJobId/deadlines
 *   POST   /jobs/:userJobId/deadlines
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '../auth.js';

const router = express.Router();
const proxy = createProxyMiddleware({
  target: process.env.JAVA_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080',
  changeOrigin: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: {
    error: (_e, _r, res) => {
      if (res && 'status' in res && typeof res.status === 'function') {
        res.status(502).json({ error: 'Planner service unavailable.' });
      }
    },
  },
});

// ── Dashboard summary ─────────────────────────────────────────────────────────
router.get('/upcoming', verifyToken, proxy);

// ── Per-job task CRUD ─────────────────────────────────────────────────────────
router.get('/jobs/:userJobId/tasks',           verifyToken, proxy);
router.post('/jobs/:userJobId/tasks/generate', verifyToken, proxy);
router.patch('/tasks/:taskId/complete',        verifyToken, proxy);

// ── Legacy route aliases (backwards-compatible) ──────────────────────────────
router.post('/generate/:userJobId',            verifyToken, proxy);
router.patch('/task/:taskId',                  verifyToken, proxy);

// ── Per-job deadline CRUD ────────────────────────────────────────────────────
router.get('/jobs/:userJobId/deadlines',       verifyToken, proxy);
router.post('/jobs/:userJobId/deadlines',      verifyToken, proxy);

export default router;
