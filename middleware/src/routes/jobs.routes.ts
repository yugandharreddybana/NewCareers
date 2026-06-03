import express from 'express';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';
import { fetchLimiter } from '../rateLimiter.js';

const router = express.Router();
router.use(authGuard);

// ── Existing routes (Phase 1 — unchanged) ──────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const r = await forward({ path: '/jobs', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.get('/limits', async (req, res, next) => {
  try {
    const r = await forward({ path: '/jobs/limits', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

// /stats must come before /:userJobId to prevent wildcard capture
router.get('/stats', async (req, res, next) => {
  try {
    const r = await forward({ path: '/jobs/stats', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.post('/fetch', fetchLimiter, async (req, res, next) => {
  try {
    const count = Math.max(1, Math.min(10, Number(req.query.count) || 5));
    const r = await forward({
      method: 'POST', path: '/jobs/fetch',
      userId: req.userId, params: { count }
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.post('/fetch-live', fetchLimiter, async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: '/jobs/fetch-live',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.post('/fetch-adzuna-live', fetchLimiter, async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: '/jobs/fetch-adzuna-live',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.post('/fetch-indeed-live', fetchLimiter, async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: '/jobs/fetch-indeed-live',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.post('/refresh-skills', async (req, res, next) => {
  try {
    const page = req.query.page ?? '0';
    const size = req.query.size ?? '500';
    const r = await forward({
      method: 'POST',
      path: '/jobs/refresh-skills',
      userId: req.userId,
      params: { page, size },
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── Section 7 — Task 73: GET /api/jobs/recommended ─────────────────────────
// Must be declared BEFORE /:userJobId so the literal string
// "recommended" is not swallowed by the param wildcard.

router.get('/recommended', async (req, res, next) => {
  try {
    const r = await forward({ path: '/jobs/recommended', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── Section 7 — Task 74: GET /api/jobs/search ────────────────────────────
// Forwards query params: q, location, minSalary, maxSalary,
// sponsorship, remote, page, size  — all optional.

router.get('/search', async (req, res, next) => {
  try {
    // Sanitise and whitelist params before forwarding to Java
    const allowed = ['q', 'location', 'minSalary', 'maxSalary',
                     'sponsorship', 'remote', 'page', 'size'];
    const params = {};
    for (const key of allowed) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params[key] = req.query[key];
      }
    }
    const r = await forward({
      path: '/jobs/search',
      userId: req.userId,
      params,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.delete('/:userJobId', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'DELETE',
      path: `/jobs/${req.params.userJobId}`,
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.post('/:userJobId/description', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: `/jobs/${req.params.userJobId}/description`,
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── Wildcard detail route — MUST stay last ─────────────────────────────────

router.get('/:userJobId', async (req, res, next) => {
  try {
    const r = await forward({ path: `/jobs/${req.params.userJobId}`, userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
