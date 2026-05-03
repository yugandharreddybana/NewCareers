import express from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();
const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: {
    error: (err, _req, res) => {
      res.status(502).json({ error: 'Backend unavailable', details: err.message });
    },
  },
});

// GET    /api/auto-apply/answers           → list answer bank
router.get('/answers',              authGuard, javaProxy);

// POST   /api/auto-apply/answers           → upsert answer
router.post('/answers',             authGuard, javaProxy);

// DELETE /api/auto-apply/answers/:id       → delete answer
router.delete('/answers/:id',       authGuard, javaProxy);

// GET    /api/auto-apply/history           → list all runs
router.get('/history',              authGuard, javaProxy);

// GET    /api/auto-apply/status/:runId     → run detail + steps
router.get('/status/:runId',        authGuard, javaProxy);

// POST   /api/auto-apply/start/:userJobId  → start new run
router.post('/start/:userJobId',    authGuard, javaProxy);

// POST   /api/auto-apply/approve/:runId    → approve or cancel run
router.post('/approve/:runId',      authGuard, javaProxy);

// POST   /api/auto-apply/retry/:runId      → retry a failed run
router.post('/retry/:runId',        authGuard, javaProxy);

export default router;
