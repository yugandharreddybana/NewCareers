// Section 3.6 Tasks 69-74 — onboarding analytics + checklist proxy routes
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '../auth.js';

const router = express.Router();
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const proxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  on: {
    error: (_err, _req, res) => {
      res.status(502).json({ error: 'Onboarding service unavailable.' });
    },
  },
});

// GET /onboarding/checklist — completed steps for FirstApplicationChecklist
router.get('/checklist', verifyToken, proxy);

// POST /onboarding/event — track step completion from backend services
router.post('/event', verifyToken, proxy);

export default router;
