// Section 3.2 — application planner routes (tasks 22-25)
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '../auth.js';

const router = express.Router();
const proxy = createProxyMiddleware({
  target: process.env.BACKEND_URL || 'http://localhost:8080',
  changeOrigin: true,
  on: { error: (_e, _r, res) => res.status(502).json({ error: 'Planner service unavailable.' }) },
});

router.post('/generate/:userJobId', verifyToken, proxy); // Task 22 — generate tasks
router.patch('/task/:taskId',       verifyToken, proxy); // Task 23 — mark complete
router.get('/upcoming',             verifyToken, proxy); // Task 24 — upcoming deadlines

export default router;
