import express from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';
import { skillLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.use(authGuard, skillLimiter);

const passthroughs = [
  ['post', '/evaluate'],
  ['post', '/tailor-resume'],
  ['post', '/research'],
  ['post', '/outreach'],
  ['post', '/apply'],
  ['post', '/prep-interview'],
  ['post', '/compare'],
  ['post', '/triage'],
];

for (const [method, path] of passthroughs) {
  router[method](path, async (req, res, next) => {
    try {
      const r = await forward({
        method: method.toUpperCase(), path: `/skills${path}`,
        userId: req.userId, data: req.body
      });
      bubble(r, res);
    } catch (e) { next(e); }
  });
}

router.get('/last', async (req, res, next) => {
  try {
    const r = await forward({
      path: '/skills/last', userId: req.userId, params: req.query
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
