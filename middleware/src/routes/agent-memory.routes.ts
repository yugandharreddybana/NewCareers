import express from 'express';
import { authGuard } from '../authGuard.js';
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

// GET    /api/agent-memory              → list memories (?category=)
router.get('/',              authGuard, javaProxy);

// POST   /api/agent-memory              → upsert memory
router.post('/',             authGuard, javaProxy);

// PATCH  /api/agent-memory/:id/toggle   → enable/disable memory
router.patch('/:id/toggle',  authGuard, javaProxy);

// DELETE /api/agent-memory/:id          → delete memory
router.delete('/:id',        authGuard, javaProxy);

export default router;
