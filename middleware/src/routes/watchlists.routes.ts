/**
 * watchlists.routes.ts — saved job search watchlists + run history
 *
 * Fixed: route ordering bug — GET /suggestions was registered AFTER GET /:id,
 * so Express would match the literal string "suggestions" as a job-watchlist ID
 * and the suggestions endpoint was unreachable. Moved /suggestions BEFORE /:id.
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

// ⚠️  Specific routes MUST come before parameterised routes to avoid shadowing.

// GET  /api/watchlists/suggestions  → smart query suggestions from profile
// MUST be before /:id or Express catches "suggestions" as an id param
router.get('/suggestions',     authGuard, javaProxy);

// GET  /api/watchlists             → list all watchlists
router.get('/',                authGuard, javaProxy);

// POST /api/watchlists             → create watchlist
router.post('/',               authGuard, javaProxy);

// GET  /api/watchlists/:id         → get single watchlist
router.get('/:id',             authGuard, javaProxy);

// PUT  /api/watchlists/:id         → update watchlist
router.put('/:id',             authGuard, javaProxy);

// DELETE /api/watchlists/:id       → delete watchlist
router.delete('/:id',          authGuard, javaProxy);

// POST /api/watchlists/:id/toggle  → toggle active/paused
router.post('/:id/toggle',     authGuard, javaProxy);

// GET  /api/watchlists/:id/runs    → run history
router.get('/:id/runs',        authGuard, javaProxy);

export default router;
