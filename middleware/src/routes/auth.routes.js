import express from 'express';
import { body } from 'express-validator';
import { forward } from '../services/backendProxy.js';
import { checkValidation, trimStrings } from '../middleware/sanitize.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const COOKIE = process.env.COOKIE_NAME || 'co_session';

const cookieOpts = () => ({
  httpOnly: true,
  secure: String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
});

router.post('/signup',
  authLimiter, trimStrings,
  body('name').isString().isLength({ min: 1 }),
  body('username').isString().isLength({ min: 3, max: 32 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({ method: 'POST', path: '/auth/register', data: req.body });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      res.cookie(COOKIE, r.data.token, cookieOpts());
      res.json({ user: r.data.user });
    } catch (e) { next(e); }
  });

router.post('/login',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({ method: 'POST', path: '/auth/login', data: req.body });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      res.cookie(COOKIE, r.data.token, cookieOpts());
      res.json({ user: r.data.user });
    } catch (e) { next(e); }
  });

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.post('/forgot-password',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({ method: 'POST', path: '/auth/forgot-password', data: req.body });
      res.status(r.status).json(r.data ?? {});
    } catch (e) { next(e); }
  });

router.post('/reset-password',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('otp').isString().isLength({ min: 4, max: 8 }),
  body('newPassword').isString().isLength({ min: 8 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({ method: 'POST', path: '/auth/reset-password', data: req.body });
      res.status(r.status).json(r.data ?? {});
    } catch (e) { next(e); }
  });

router.get('/me', (req, res) => {
  // re-derived from cookie on demand by frontend
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  // Cheap session check; full user data already loaded by frontend on login.
  res.json({ ok: true });
});

export default router;
