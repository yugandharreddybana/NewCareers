/**
 * interview.routes.ts — Phase 3.1 Interview Command Center
 *
 * POST /api/interviews/generate-kit/:userJobId  — generate AI interview kit
 * GET  /api/interviews/kit/:userJobId           — fetch questions for job
 * POST /api/interviews/mock/start/:userJobId    — start mock session
 * POST /api/interviews/mock/reply/:sessionId    — submit answer + get score
 * GET  /api/interviews/history/:userJobId       — sessions for a job
 * GET  /api/interviews/history                  — all sessions for user
 * GET  /api/interviews/tracks                   — all interview tracks
 * GET  /api/interviews/tracks/:userJobId        — single track for a job
 * PATCH /api/interviews/tracks/:userJobId/stage — update stage
 */
import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const javaProxy = createJavaRouteProxy('/interviews', {
  errorMessage: 'Interview service unavailable',
  timeoutMs: 90_000,
});

// Specific routes before parameterised ones
router.get('/history',                     authGuard, javaProxy);
router.get('/tracks/:userJobId',           authGuard, javaProxy);
router.get('/tracks',                      authGuard, javaProxy);
router.post('/generate-kit/:userJobId',    authGuard, javaProxy);
router.get('/kit/:userJobId',              authGuard, javaProxy);
router.post('/mock/start/:userJobId',      authGuard, javaProxy);
router.post('/mock/reply/:sessionId',      authGuard, javaProxy);
router.get('/history/:userJobId',          authGuard, javaProxy);
router.patch('/tracks/:userJobId/stage',   authGuard, javaProxy);

export default router;
