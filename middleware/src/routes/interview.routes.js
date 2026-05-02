import express from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();

const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  proxyTimeout: 60_000,
  timeout: 60_000,
  on: {
    error: (err, req, res) => {
      res.status(502).json({ error: 'Backend unavailable', details: err.message });
    },
  },
});

// ── Track ──────────────────────────────────────────────────────────────────
// POST /api/interview/track?userJobId=   → get or create interview track
router.post('/track', authGuard, javaProxy);

// GET  /api/interview/tracks             → list all tracks for current user
router.get('/tracks', authGuard, javaProxy);

// PATCH /api/interview/track/:trackId/stage?stage=   → update interview stage
router.patch('/track/:trackId/stage', authGuard, javaProxy);

// ── Question Kit ───────────────────────────────────────────────────────────
// POST /api/interview/kit?userJobId=     → generate AI question kit (slow — 60s timeout)
router.post('/kit', authGuard, javaProxy);

// GET  /api/interview/kit/:trackId       → fetch existing kit questions
router.get('/kit/:trackId', authGuard, javaProxy);

// ── PDF Export ─────────────────────────────────────────────────────────────
// GET  /api/interview/pdf/:trackId       → export interview kit as PDF
router.get('/pdf/:trackId', authGuard, javaProxy);

// GET  /api/interview/pdf/session/:sessionId → export mock interview report as PDF
router.get('/pdf/session/:sessionId', authGuard, javaProxy);

// ── Mock Session ───────────────────────────────────────────────────────────
// POST /api/interview/session/start?userJobId=
router.post('/session/start', authGuard, javaProxy);

// POST /api/interview/session/:sessionId/answer?questionId=
router.post('/session/:sessionId/answer', authGuard, javaProxy);

// POST /api/interview/session/:sessionId/complete
router.post('/session/:sessionId/complete', authGuard, javaProxy);

// GET  /api/interview/session/history?userJobId=
router.get('/session/history', authGuard, javaProxy);

// ── Reminder Notification ──────────────────────────────────────────────────
// POST /api/interview/track/:trackId/remind  → set interview date + trigger reminder
router.post('/track/:trackId/remind', authGuard, javaProxy);

export default router;
