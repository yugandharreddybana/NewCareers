import express from 'express';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';
import { resolveClientIp } from '../trustedClientIp.js';

const router = express.Router();
router.use(authGuard);

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
      ip: resolveClientIp(req),
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
      ip: resolveClientIp(req),
      headers: clientForwardHeaders(req),
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

export default router;
