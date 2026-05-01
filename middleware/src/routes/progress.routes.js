// Section 3.5 — progress routes: auth guard + proxy to Java backend
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const proxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  on: {
    error: (err, _req, res) => {
      console.error('[progress proxy error]', err.message);
      res.status(502).json({ error: 'Progress service temporarily unavailable.' });
    },
  },
});

// Task 61 — GET /progress/weekly-summary
router.get('/weekly-summary', verifyToken, proxy);

// Task 62 — GET /progress/streaks
router.get('/streaks', verifyToken, proxy);

// POST /progress/activity — record daily activity
router.post('/activity', verifyToken, proxy);

export default router;
