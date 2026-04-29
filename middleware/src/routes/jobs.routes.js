import express from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';
import { fetchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.use(authGuard);

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

router.get('/:userJobId', async (req, res, next) => {
  try {
    const r = await forward({ path: `/jobs/${req.params.userJobId}`, userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
