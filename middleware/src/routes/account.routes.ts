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

router.get('/export', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'GET',
      path: '/account/export',
      userId: req.userId,
      ip: clientIp(req),
      headers: clientForwardHeaders(req),
      responseType: 'arraybuffer',
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'DELETE',
      path: '/account',
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

/** POST alias — DELETE bodies are dropped by some HTTP clients on the Java hop. */
router.post('/delete', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: '/account/delete',
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
