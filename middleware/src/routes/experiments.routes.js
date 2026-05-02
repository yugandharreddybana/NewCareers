// Section 3.6 Tasks 76-79 — experiment variant proxy routes
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const proxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  on: {
    error: (_err, _req, res) => {
      res.status(502).json({ error: 'Experiment service unavailable.' });
    },
  },
});

// GET /experiments/variants — load all active variants for the user
router.get('/variants', verifyToken, proxy);

// GET /experiments/variant/:key — single variant lookup
router.get('/variant/:key', verifyToken, proxy);

export default router;
