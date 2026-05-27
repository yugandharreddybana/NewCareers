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
import { verifyToken } from '../auth.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const proxy = createJavaRouteProxy('/planner', {
  errorMessage: 'Planner service unavailable.',
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
