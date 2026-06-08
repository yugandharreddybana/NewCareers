/**
 * auth.routes.ts — authentication endpoints with HttpOnly refresh cookies.
 */
import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import { body } from 'express-validator';
import { forward } from '../services/backendProxy.js';
import { checkValidation, trimStrings } from '../sanitize.js';
import { authLimiter, loginLimiter, csrfGuard } from '../rateLimiter.js';
import { authGuard } from '../authGuard.js';
import { verifySessionToken } from '../jwtVerification.js';
import { resolveClientIp } from '../trustedClientIp.js';

const router = express.Router();

const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => {
    const ok = /\.(pdf|docx)$/i.test(f.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Only PDF or DOCX'));
  },
});

function clientForwardHeaders(req: express.Request): Record<string, string> {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? { 'user-agent': ua } : {};
}
const COOKIE = process.env.COOKIE_NAME || 'co_session';
const REFRESH_COOKIE = 'co_refresh';
const REMEMBER_FLAG = 'co_remember';

const ACCESS_COOKIE_MS = 15 * 60 * 1000;
const REMEMBER_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

const baseCookieOpts = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'strict' | 'lax' | 'none',
  path: '/',
});

const accessCookieOpts = () => ({
  ...baseCookieOpts(),
  maxAge: ACCESS_COOKIE_MS,
});

const rememberRefreshCookieOpts = () => ({
  ...baseCookieOpts(),
  maxAge: REMEMBER_REFRESH_MS,
});

const sessionRefreshCookieOpts = () => baseCookieOpts();

type AuthPayload = {
  token?: string;
  refreshToken?: string;
  user?: unknown;
};

type LoginFlowPayload = AuthPayload & {
  requiresTwoFactor?: boolean;
  challengeToken?: string;
};

function resolveRememberMe(req: express.Request, explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  return req.cookies?.[REMEMBER_FLAG] === '1';
}

function issueAuthCookies(
  res: express.Response,
  data: AuthPayload,
  rememberMe: boolean,
) {
  if (data.token) {
    res.cookie(COOKIE, data.token, accessCookieOpts());
  }
  if (!data.refreshToken) {
    return;
  }
  if (rememberMe) {
    res.cookie(REFRESH_COOKIE, data.refreshToken, rememberRefreshCookieOpts());
    res.cookie(REMEMBER_FLAG, '1', rememberRefreshCookieOpts());
  } else {
    res.cookie(REFRESH_COOKIE, data.refreshToken, sessionRefreshCookieOpts());
    res.clearCookie(REMEMBER_FLAG, baseCookieOpts());
  }
}

function authJsonResponse(
  res: express.Response,
  data: AuthPayload,
  rememberMe: boolean,
) {
  issueAuthCookies(res, data, rememberMe);
  return res.json({ token: data.token, user: data.user });
}

function clearAuthCookies(res: express.Response) {
  const clear = baseCookieOpts();
  res.clearCookie(COOKIE, clear);
  res.clearCookie(REFRESH_COOKIE, clear);
  res.clearCookie(REMEMBER_FLAG, clear);
}

router.use(csrfGuard);

router.post('/signup-intent',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('consents').isObject(),
  body('captchaToken').optional().isString(),
  body('name').optional().isString().isLength({ max: 100 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/signup-intent',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      return res.json(r.data);
    } catch (e) { next(e); }
  });

router.post('/signup',
  authLimiter, trimStrings,
  body('name').isString().isLength({ min: 1 }),
  body('username').isString().isLength({ min: 3, max: 32 }),
  body('email').isEmail().normalizeEmail(),
  body('password').optional().isString().isLength({ min: 8, max: 128 }),
  body('signupIntentId').optional().isUUID(),
  body('emailVerificationId').optional().isUUID(),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/register',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      authJsonResponse(res, r.data as AuthPayload, false);
    } catch (e) { next(e); }
  });

router.post('/google/link/confirm',
  authLimiter, trimStrings,
  body('idToken').isString().isLength({ min: 100, max: 8192 }),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('rememberMe').optional().isBoolean(),
  body('captchaToken').optional().isString(),
  checkValidation,
  async (req, res, next) => {
    try {
      const rememberMe = Boolean(req.body.rememberMe);
      const r = await forward({
        method: 'POST',
        path: '/auth/google/link/confirm',
        data: {
          idToken: req.body.idToken,
          password: req.body.password,
          captchaToken: req.body.captchaToken,
        },
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      authJsonResponse(res, r.data as AuthPayload, rememberMe);
    } catch (e) { next(e); }
  });

router.post('/google',
  authLimiter, trimStrings,
  body('idToken').isString().isLength({ min: 100, max: 8192 }),
  body('rememberMe').optional().isBoolean(),
  body('consents').optional().isObject(),
  body('captchaToken').optional().isString(),
  checkValidation,
  async (req, res, next) => {
    try {
      const rememberMe = Boolean(req.body.rememberMe);
      const r = await forward({
        method: 'POST',
        path: '/auth/google',
        data: {
          idToken: req.body.idToken,
          consents: req.body.consents,
          captchaToken: req.body.captchaToken,
        },
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      authJsonResponse(res, r.data as AuthPayload, rememberMe);
    } catch (e) { next(e); }
  });

router.get('/captcha/challenge',
  authLimiter,
  async (_req, res, next) => {
    try {
      const r = await forward({
        method: 'GET',
        path: '/auth/captcha/challenge',
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      return res.json(r.data);
    } catch (e) { next(e); }
  });

router.post('/login',
  loginLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('captchaToken').optional().isString(),
  body('rememberMe').optional().isBoolean(),
  checkValidation,
  async (req, res, next) => {
    try {
      const rememberMe = Boolean(req.body.rememberMe);
      const r = await forward({
        method: 'POST',
        path: '/auth/login',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      const data = r.data as LoginFlowPayload;
      if (data.requiresTwoFactor) {
        return res.json({
          requiresTwoFactor: true,
          challengeToken: data.challengeToken,
        });
      }
      authJsonResponse(res, data, rememberMe);
    } catch (e) { next(e); }
  });

router.post('/two-factor/verify',
  loginLimiter, trimStrings,
  body('challengeToken').isString().isLength({ min: 10 }),
  body('code').matches(/^\d{6}$/),
  checkValidation,
  async (req, res, next) => {
    try {
      const rememberMe = resolveRememberMe(req);
      const r = await forward({
        method: 'POST',
        path: '/auth/two-factor/verify',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      authJsonResponse(res, r.data as AuthPayload, rememberMe);
    } catch (e) { next(e); }
  });

router.post('/refresh',
  authLimiter,
  async (req, res, next) => {
    try {
      const cookieRefresh = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      const bodyRefresh = req.body?.refreshToken as string | undefined;
      const refreshToken = bodyRefresh || cookieRefresh;
      if (!refreshToken || refreshToken.length < 10) {
        return res.status(401).json({ error: 'Refresh token required' });
      }
      const rememberMe = resolveRememberMe(req);
      const r = await forward({
        method: 'POST',
        path: '/auth/refresh',
        data: { refreshToken },
      });
      if (r.status >= 400) return res.status(r.status).json(r.data);
      authJsonResponse(res, r.data as AuthPayload, rememberMe);
    } catch (e) { next(e); }
  });

router.post('/logout', async (req, res) => {
  const clearOpts = baseCookieOpts();
  const refreshToken =
    (req.body?.refreshToken as string | undefined)
    || (req.cookies?.[REFRESH_COOKIE] as string | undefined);

  let userId: string | undefined;
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : undefined;
  const cookieToken = req.cookies?.[COOKIE] as string | undefined;
  const token = bearer || cookieToken;

  if (token && process.env.JWT_PUBLIC_KEY) {
    try {
      const payload = verifySessionToken(token);
      userId = payload.sub === 'dev-user-123'
        ? '00000000-0000-0000-0000-000000000001'
        : payload.sub;
    } catch {
      /* expired */
    }
  }

  try {
    if (userId) {
      const r = await forward({
        method: 'POST',
        path: '/auth/logout',
        userId,
        data: {
          ...(refreshToken ? { refreshToken } : {}),
          ...(token ? { accessToken: token } : {}),
        },
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (r.status >= 400) {
        console.warn(`Backend logout returned ${r.status}; clearing cookies anyway`);
      }
    }
  } catch {
    /* still clear cookies */
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.post('/onboarding/check-email',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/onboarding/check-email',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data ?? {});
      res.status(200).json(r.data ?? { available: true });
    } catch (e) { next(e); }
  });

router.post('/onboarding/check-password',
  authLimiter, trimStrings,
  body('signupIntentId').isUUID(),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 128 }),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/onboarding/check-password',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data ?? {});
      res.status(200).json(r.data ?? { secure: true });
    } catch (e) { next(e); }
  });

router.post('/onboarding/send-verification-otp',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('firstName').optional().isString().isLength({ max: 100 }),
  body('captchaToken').optional().isString(),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/onboarding/send-verification-otp',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data ?? {});
      res.status(202).json(r.data ?? { resendsRemaining: 3, retryAfterSeconds: 0 });
    } catch (e) { next(e); }
  });

router.post('/onboarding/resend-verification-otp',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('captchaToken').optional().isString(),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/onboarding/resend-verification-otp',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status === 429) {
        return res.status(429).json(r.data ?? { error: 'Please wait before requesting a new code.' });
      }
      if (r.status >= 400) return res.status(r.status).json(r.data ?? {});
      res.status(202).json(r.data ?? { resendsRemaining: 0, retryAfterSeconds: 0 });
    } catch (e) { next(e); }
  });

router.post('/onboarding/verify-email',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('otp').isString().matches(/^\d{8}$/),
  body('captchaToken').optional().isString(),
  checkValidation,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'POST',
        path: '/auth/onboarding/verify-email',
        data: req.body,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data ?? {});
      res.status(200).json(r.data ?? {});
    } catch (e) { next(e); }
  });

router.get('/signup-intent/:id/exists',
  authLimiter,
  async (req, res, next) => {
    try {
      const r = await forward({
        method: 'GET',
        path: `/auth/signup-intent/${req.params.id}/exists`,
        ip: resolveClientIp(req),
        headers: clientForwardHeaders(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data ?? {});
      res.status(200).json(r.data ?? {});
    } catch (e) { next(e); }
  });

router.post('/onboarding/parse-cv',
  authLimiter,
  cvUpload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Upload your CV to continue' });
      const signupIntentId = typeof req.body.signupIntentId === 'string' ? req.body.signupIntentId : undefined;
      const email = typeof req.body.email === 'string' ? req.body.email : undefined;
      const captchaToken = typeof req.body.captchaToken === 'string' ? req.body.captchaToken : undefined;
      const fd = new FormData();
      fd.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      if (signupIntentId) fd.append('signupIntentId', signupIntentId);
      if (email) fd.append('email', email);
      if (captchaToken) fd.append('captchaToken', captchaToken);
      const r = await forward({
        method: 'POST',
        path: '/auth/onboarding/parse-cv',
        data: fd,
        headers: fd.getHeaders(),
        ip: resolveClientIp(req),
      });
      if (r.status >= 400) return res.status(r.status).json(r.data ?? {});
      res.status(200).json(r.data ?? {});
    } catch (e) { next(e); }
  });

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
      console.error('Forgot-password backend error:', (e as Error).message);
      res.status(202).json({ message: 'If that email exists in our system, we have sent a reset OTP.' });
    }
  });

router.post('/reset-password',
  authLimiter, trimStrings,
  body('email').isEmail().normalizeEmail(),
  body('otp').isString().matches(/^\d{8}$/),
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
