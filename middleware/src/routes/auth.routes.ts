/**
 * auth.routes.ts — authentication endpoints
 *
 * A5 fix: reset-password route body shape corrected.
 *   Old validators expected: { email, otp, newPassword }
 *   Frontend authApi.resetPassword sends:  { token, password }
 *   The Java backend contract is:           { token, password }
 *   Fixed validators now match the actual contract.
 *
 * G1 fix (Batch 7a): /auth/me now properly verifies the JWT via authGuard
 *   and proxies to Java /auth/me to confirm session validity.
 *   Old implementation only checked if the cookie existed — any token
 *   (expired, tampered, fabricated) would pass the check.
 *
 * All other routes (signup, login, refresh, logout, forgot-password)
 * are unchanged.
 */
import express from 'express';
import { body } from 'express-validator';
import { forward } from '../services/backendProxy.js';
import { checkValidation, trimStrings } from '../sanitize.js';
import { authLimiter, loginLimiter, csrfGuard } from '../rateLimiter.js';
import { authGuard } from '../authGuard.js';

const router = express.Router();
const COOKIE = process.env.COOKIE_NAME || 'co_session';

const cookieOpts = () => ({
  httpOnly: true,
  secure: String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
});

// Apply CSRF protection to all auth state-changing routes
router.use(csrfGuard);

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
      res.json({ user: r.data.user, token: r.data.token, refreshToken: r.data.refreshToken });
    } catch (e) { next(e); }
  });

// ── Login ──────────────────────────────────────────────────────────────────
router.post('/login',
  loginLimiter, trimStrings,
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
      res.cookie(COOKIE, r.data.token, cookieOpts());
      res.json({ token: r.data.token, refreshToken: r.data.refreshToken, user: r.data.user });
    } catch (e) { next(e); }
  });

// ── Logout ─────────────────────────────────────────────────────────────────
router.post('/logout',
  authGuard,
  async (req, res, next) => {
    try {
      await forward({
        method: 'POST',
        path: '/auth/logout',
        userId: req.userId,
      }).catch(err => console.warn('Backend logout non-fatal:', err.message));
    } finally {
      res.clearCookie(COOKIE, { path: '/' });
      res.json({ ok: true });
    }
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
// A5 fix: validators now match actual frontend + Java backend contract:
//   { token: string (the reset token from the email link), password: string }
router.post('/reset-password',
  authLimiter, trimStrings,
  body('token').isString().isLength({ min: 8 }),
  body('password').isString().isLength({ min: 8 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({ method: 'POST', path: '/auth/reset-password', data: req.body });
      res.status(r.status).json(r.data ?? {});
    } catch (e) { next(e); }
  });

// ── Session Check ──────────────────────────────────────────────────────────
// G1 fix (Batch 7a): authGuard validates + decodes the JWT before this handler
// runs. If the token is missing, expired, or tampered the guard returns 401
// before we reach here. We then proxy to Java /auth/me to confirm the
// server-side session is still valid and return the live user object.
router.get('/me',
  authGuard,
  async (req, res, next) => {
    try {
      const r = await forward({ method: 'GET', path: '/auth/me', userId: req.userId });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      res.json(r.data);
    } catch (e) { next(e); }
  });

export default router;
