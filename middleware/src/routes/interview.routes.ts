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
 * PATCH /api/interviews/tracks/:userJobId/stage — update stage
 */
import express, { Response } from 'express';
import { authGuard } from '../authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();
const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  proxyTimeout: 90_000, // AI generation can be slow
  timeout: 90_000,
  on: {
    error: (err, _req, res) => {
      if (res && 'status' in res && typeof res.status === 'function') {
        (res as Response).status(502).json({ error: 'Interview service unavailable', details: err.message });
      }
    },
  },
});

// Specific routes before parameterised ones
router.get('/history',                     authGuard, javaProxy);
router.get('/tracks',                      authGuard, javaProxy);
router.post('/generate-kit/:userJobId',    authGuard, javaProxy);
router.get('/kit/:userJobId',              authGuard, javaProxy);
router.post('/mock/start/:userJobId',      authGuard, javaProxy);
router.post('/mock/reply/:sessionId',      authGuard, javaProxy);
router.get('/history/:userJobId',          authGuard, javaProxy);
router.patch('/tracks/:userJobId/stage',   authGuard, javaProxy);

export default router;
