import express from 'express';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();
router.use(authGuard);

function clientIp(req: express.Request): string | undefined {
  return (typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for']
    : undefined) || req.ip;
}

function clientForwardHeaders(req: express.Request): Record<string, string> {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? { 'user-agent': ua } : {};
}

router.get('/', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'GET',
      path: '/consents',
      userId: req.userId,
      ip: clientIp(req),
      headers: clientForwardHeaders(req),
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: '/consents',
      userId: req.userId,
      data: req.body,
      ip: clientIp(req),
      headers: clientForwardHeaders(req),
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

export default router;
