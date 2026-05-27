/**
 * public.routes.ts — unauthenticated public-facing endpoints.
 *
 * Pass 6 #6.016 — proxies GET /public/stats to the Java backend so the
 * marketing/Login page can render real, honest counts. NO authGuard,
 * NO csrfGuard — anonymous fetch must succeed before login.
 *
 * The stats endpoint is rate-limited per IP to prevent abuse.
 */
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { forward } from '../services/backendProxy.js';

const router = express.Router();

const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 fetches/min/IP — comfortable for any honest visitor
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down — too many requests.' },
});

router.get('/stats', statsLimiter, async (_req, res, next) => {
  try {
    const r = await forward({ method: 'GET', path: '/public/stats' });
    res.status(r.status);
    const cacheControl = r.headers['cache-control'];
    if (typeof cacheControl === 'string') {
      res.setHeader('cache-control', cacheControl);
    }
    res.json(r.data);
  } catch (e) {
    next(e);
  }
});

export default router;
