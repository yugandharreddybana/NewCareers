/**
 * watchlists.routes.ts — saved job search watchlists + run history
 *
 * Fixed: route ordering bug — GET /suggestions was registered AFTER GET /:id,
 * so Express would match the literal string "suggestions" as a job-watchlist ID
 * and the suggestions endpoint was unreachable. Moved /suggestions BEFORE /:id.
 */
import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const javaProxy = createJavaRouteProxy('/watchlists');

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
