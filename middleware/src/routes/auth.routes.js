/**
 * Task 119 — auth.routes.js updated:
 *  - POST /refresh  → forwards to Java /auth/refresh, rotates co_session cookie
 *  - POST /logout   → calls Java /auth/logout (blacklist) then clears co_session cookie
 *
 * All previous routes (signup, login, forgot-password, reset-password, me) are unchanged.
 */
import express from 'express';
import { body } from 'express-validator';
import { forward } from '../services/backendProxy.js';
import { checkValidation, trimStrings } from '../middleware/sanitize.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authGuard } from '../middleware/authGuard.js';

const router = express.Router();
const COOKIE = process.env.COOKIE_NAME || 'co_session';

const cookieOpts = () => ({
  httpOnly: true,
  secure: String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
});

// ── Signup ─────────────────────────────────────────────────────────────────
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
      // Return token + refreshToken to frontend so tokenStore can persist them
      res.json({ user: r.data.user, token: r.data.token, refreshToken: r.data.refreshToken });
    } catch (e) { next(e); }
  });

// ── Login ──────────────────────────────────────────────────────────────────
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
      res.json({ user: r.data.user, token: r.data.token, refreshToken: r.data.refreshToken });
    } catch (e) { next(e); }
  });

// ── Refresh ────────────────────────────────────────────────────────────────
// Accepts { refreshToken } in body, forwards to Java, rotates cookie + returns new tokens.
router.post('/refresh',
  authLimiter, trimStrings,
  body('refreshToken').isString().isLength({ min: 10 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/refresh',
        data: { refreshToken: req.body.refreshToken },
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      // Rotate the HttpOnly session cookie with the new access token
      res.cookie(COOKIE, r.data.token, cookieOpts());
      res.json({ token: r.data.token, refreshToken: r.data.refreshToken, user: r.data.user });
    } catch (e) { next(e); }
  });

// ── Logout ─────────────────────────────────────────────────────────────────
// Calls Java /auth/logout to blacklist the refresh token, then clears the cookie.
router.post('/logout',
  authGuard,
  async (req, res, next) => {
    try {
      // Forward logout to Java so it blacklists the refresh token in DB.
      // Non-fatal: even if backend call fails, we still clear the cookie.
      await forward({
        method: 'POST',
        path: '/auth/logout',
        userId: req.userId,
      }).catch(err => console.warn('Backend logout non-fatal:', err.message));
    } finally {
      res.clearCookie(COOKIE, { path: '/' });
      res.json({ ok: true });
    }
    // next() not needed — response already sent
  });

// ── Forgot Password ────────────────────────────────────────────────────────
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

// ── Reset Password ─────────────────────────────────────────────────────────
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

// ── Session Check ──────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ ok: true });
});

export default router;
