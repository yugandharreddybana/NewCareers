import express from 'express';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';
import { resolveClientIp } from '../trustedClientIp.js';

const router = express.Router();
router.use(authGuard);

const REFRESH_COOKIE = 'co_refresh';

function clientForwardHeaders(req: express.Request): Record<string, string> {
  const ua = req.headers['user-agent'];
  const headers: Record<string, string> = typeof ua === 'string' ? { 'user-agent': ua } : {};
  const refresh = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (refresh) {
    headers['X-Refresh-Token'] = refresh;
  }
  return headers;
}

async function forwardAccount(
  req: express.Request,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
) {
  return forward({
    method,
    path,
    userId: req.userId,
    data,
    ip: resolveClientIp(req),
    headers: clientForwardHeaders(req),
  });
}

router.get('/export', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'GET',
      path: '/account/export',
      userId: req.userId,
      ip: resolveClientIp(req),
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
      ip: resolveClientIp(req),
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
      ip: resolveClientIp(req),
      headers: clientForwardHeaders(req),
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.patch('/password', async (req, res, next) => {
  try {
    const r = await forwardAccount(req, 'PATCH', '/account/password', req.body);
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.get('/sessions', async (req, res, next) => {
  try {
    const r = await forwardAccount(req, 'GET', '/account/sessions');
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.delete('/sessions/:sessionId', async (req, res, next) => {
  try {
    const r = await forwardAccount(req, 'DELETE', `/account/sessions/${req.params.sessionId}`);
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.post('/sessions/revoke-others', async (req, res, next) => {
  try {
    const r = await forwardAccount(req, 'POST', '/account/sessions/revoke-others', req.body);
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.get('/security/activity', async (req, res, next) => {
  try {
    // Query string must be forwarded via `params`, not embedded in `path`.
    // HMAC is computed on the path only; Java verifies servlet path without query.
    const params: Record<string, string> = {};
    if (req.query.page != null) params.page = String(req.query.page);
    if (req.query.size != null) params.size = String(req.query.size);
    const r = await forward({
      method: 'GET',
      path: '/account/security/activity',
      userId: req.userId,
      params,
      ip: resolveClientIp(req),
      headers: clientForwardHeaders(req),
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.get('/two-factor/status', async (req, res, next) => {
  try {
    const r = await forwardAccount(req, 'GET', '/account/two-factor/status');
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.post('/two-factor/setup', async (req, res, next) => {
  try {
    const r = await forwardAccount(req, 'POST', '/account/two-factor/setup', req.body);
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.post('/two-factor/enable', async (req, res, next) => {
  try {
    const r = await forwardAccount(req, 'POST', '/account/two-factor/enable', req.body);
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.post('/two-factor/disable', async (req, res, next) => {
  try {
    const r = await forwardAccount(req, 'POST', '/account/two-factor/disable', req.body);
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

export default router;
