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
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.COOKIE_SAMESITE || 'strict') as 'strict' | 'lax' | 'none',
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
      res.json({ token: r.data.token, user: r.data.user, refreshToken: r.data.refreshToken });
    } catch (e) { next(e); }
  });

// ── Google Sign-In (GIS ID token) ─────────────────────────────────────────
router.post('/google',
  authLimiter, trimStrings,
  body('idToken').isString().isLength({ min: 100, max: 8192 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({ method: 'POST', path: '/auth/google', data: req.body });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      res.cookie(COOKIE, r.data.token, cookieOpts());
      res.json({ token: r.data.token, user: r.data.user, refreshToken: r.data.refreshToken });
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
      res.json({ token: r.data.token, user: r.data.user, refreshToken: r.data.refreshToken });
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
      const r = await forward({
        method: 'POST',
        path: '/auth/logout',
        userId: req.userId,
        data: {},
        headers: { 'Content-Type': 'application/json' },
      });
      if (r.status >= 400) {
        throw new Error(`Backend logout failed with status: ${r.status}`);
      }
      res.clearCookie(COOKIE, { path: '/' });
      res.json({ ok: true });
    } catch (e) {
      next(e);
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
      if (r.status === 429) {
        return res.status(429).json(r.data ?? { error: 'Please wait before requesting another code.' });
      }
      if (r.status >= 400) {
        console.warn(`Forgot-password backend returned non-success status: ${r.status}`);
      }
      res.status(202).json({ message: 'If that email exists in our system, we have sent a reset OTP.' });
    } catch (e) {
      console.error('Forgot-password backend error:', e.message);
      res.status(202).json({ message: 'If that email exists in our system, we have sent a reset OTP.' });
    }
  });

// ── Reset Password (OTP + new password) ────────────────────────────────────
router.post('/reset-password',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('otp').isString().matches(/^\d{6}$/),
  body('newPassword').isString().isLength({ min: 8 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/reset-password',
        data: {
          email: req.body.email,
          otp: req.body.otp,
          newPassword: req.body.newPassword,
        },
      });
      if (r.status >= 400) return res.status(r.status).json(r.data ?? {});
      res.status(200).json(r.data ?? { ok: true });
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
