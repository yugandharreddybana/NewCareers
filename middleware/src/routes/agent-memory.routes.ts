/**
 * agent-memory.routes.ts — per-user AI agent memory store
 *
 * Fixed: missing GET /:id route — the UI and Java backend both support
 * fetching a single memory by ID, but no middleware route existed for it,
 * causing 404s on any direct memory fetch.
 */
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

// GET    /api/agent-memory              → list memories (?category= filter supported)
router.get('/',              authGuard, javaProxy);

// POST   /api/agent-memory              → upsert memory entry
router.post('/',             authGuard, javaProxy);

// GET    /api/agent-memory/:id          → fetch single memory by ID (was missing)
router.get('/:id',           authGuard, javaProxy);

// PATCH  /api/agent-memory/:id/toggle   → enable/disable a memory entry
router.patch('/:id/toggle',  authGuard, javaProxy);

// PUT    /api/agent-memory/:id          → update memory content
router.put('/:id',           authGuard, javaProxy);

// DELETE /api/agent-memory/:id          → delete a memory entry
router.delete('/:id',        authGuard, javaProxy);

export default router;
