import './loadEnv.js';
import { validateStartupSecrets } from './startupValidation.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import compression from 'compression';
import { stripXss } from './sanitize';
import axios from 'axios';
import hpp from 'hpp';
import { logger } from './logger.js';
import {
  CSRF_COOKIE,
  createBillingWebhookRateLimit,
  createCsrfProtection,
  createGlobalApiRateLimit,
} from './apiProtection.js';
import { forwardRawBillingWebhook } from './services/backendProxy.js';

// ── C2 fix: startup env validation ────────────────────────────────────────────────
// Fail fast at startup if critical env vars are missing instead of crashing
// at runtime when the first request hits a code path that needs them.
const REQUIRED_ENV = [
  'JWT_PUBLIC_KEY',
  'JAVA_BACKEND_URL',
];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`[startup] FATAL: missing required env vars: ${missingEnv.join(', ')}`);
  process.exit(1);
}

validateStartupSecrets();

const javaBackendUrl = process.env.JAVA_BACKEND_URL || '';
if (javaBackendUrl.includes(':8100')) {
  console.warn(
    '[startup] JAVA_BACKEND_URL points at :8100 (H2 test profile). ' +
      'For Postgres dev on :8080, set JAVA_BACKEND_URL=http://localhost:8080 in middleware/.env',
  );
}

import auth from './routes/auth.routes.js';
import profile from './routes/profile.routes.js';
import jobs from './routes/jobs.routes.js';
import kanban from './routes/kanban.routes.js';
import skills from './routes/skills.routes.js';
import analytics from './routes/analytics.routes.js';
import notifications from './routes/notifications.routes.js';
import referrals from './routes/referrals.routes.js';
import interview from './routes/interview.routes.js';
import planner from './routes/planner.routes.js';
import networking from './routes/networking.routes.js';
import workspace from './routes/workspace.routes.js';
import progress from './routes/progress.routes.js';
import onboarding from './routes/onboarding.routes.js';
import experiments from './routes/experiments.routes.js';
import autoApply from './routes/auto-apply.routes.js';
import outreach from './routes/outreach.routes.js';
import watchlists from './routes/watchlists.routes.js';
import agentMemory from './routes/agent-memory.routes.js';
import resumeVersions from './routes/resume-versions.routes.js';
import cv from './routes/cv.routes.js';
import billing from './routes/billing.routes.js';
import adminSaas from './routes/admin-saas.routes.js';
import usage from './routes/usage.routes.js';
import consents from './routes/consents.routes.js';
import userConsent from './routes/user.consent.routes.js';
import account from './routes/account.routes.js';
import publicRoutes from './routes/public.routes.js';
import { forward } from './services/backendProxy.js';

const app = express();

// ── C1 fix: CORS — supports multiple allowed origins ────────────────────────────
// ALLOWED_ORIGINS is a comma-separated list of allowed origins.
// e.g. ALLOWED_ORIGINS=https://app.careerhub.io,https://staging.careerhub.io
// Falls back to a single ALLOWED_ORIGIN or localhost for backwards compat.
const IS_PROD = process.env.NODE_ENV === 'production';
const rawOrigins = process.env.ALLOWED_ORIGINS
  || process.env.ALLOWED_ORIGIN
  || 'http://localhost:5173,http://localhost:5174,http://localhost:3000';
const ALLOWED_ORIGINS = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

/** Vite may bind 5174+ when 5173 is taken — allow any local dev port in non-prod. */
function isLocalDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
      && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl, Postman, Vite proxy)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (!IS_PROD && isLocalDevOrigin(origin)) return callback(null, true);
    if (!IS_PROD) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));

// Request nonce generator for safe inline scripts and styles
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Helmet with explicit Content-Security-Policy
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res: any) => `'nonce-${res.locals.nonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS, 'https://api.stripe.com'],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// C5 fix: compression — gzip/brotli all JSON responses
// Must come before routes. Skips already-compressed content-types.
app.use(compression());

// Stripe webhook: preserve raw body for proxy to Java (signature verification runs on the Java backend).
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));

// Early Content-Length check to reject oversized payloads before parsing (9.035: raised to 5MB on skills route)
app.use((req, res, next) => {
  const isSkillsRoute = req.path.startsWith('/api/v1/skills') || req.path.startsWith('/skills');
  const limit = isSkillsRoute ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
  const contentLength = Number(req.headers['content-length']);
  if (contentLength && contentLength > limit) {
    return res.status(413).json({ error: `Payload too large — maximum size allowed is ${isSkillsRoute ? '5MB' : '2MB'}.` });
  }
  next();
});

// Capture raw JSON bytes so proxy can forward exact payloads when needed.
const captureRawBody: Parameters<typeof express.json>[0]['verify'] = (req, _res, buf) => {
  (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
};

// Specific larger body parser for skills endpoints
app.use('/api/v1/skills', express.json({ limit: '5mb', verify: captureRawBody }));

app.use(express.json({ limit: '2mb', verify: captureRawBody }));
app.use(hpp());
app.use(stripXss);
app.use(cookieParser());

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 9.031 Fix: Response-time tracker to log warnings for slow requests (> 2s)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 2000) {
      console.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl || req.url} took ${duration}ms`);
    }
  });
  next();
});

// ── CSRF protection — double-submit cookie (cookie + X-CSRF-Token header) ───────
const csrfProtection = createCsrfProtection();
const globalApiRateLimit = createGlobalApiRateLimit();
const billingWebhookRateLimit = createBillingWebhookRateLimit();

declare global {
  namespace Express {
    interface Request {
      /** Token minted on this request when the browser had no CSRF cookie yet. */
      issuedCsrfToken?: string;
      /** Raw request body captured before JSON parsing (for exact proxy forwarding). */
      rawBody?: Buffer;
    }
  }
}

app.use((req, res, next) => {
  const existing = req.cookies[CSRF_COOKIE] as string | undefined;
  const csrfToken = existing || crypto.randomBytes(32).toString('hex');
  if (!existing) {
    req.issuedCsrfToken = csrfToken;
  }
  res.cookie(CSRF_COOKIE, csrfToken, {
    // Dev: readable so axios can mirror it in X-CSRF-Token (double-submit).
    httpOnly: IS_PROD,
    sameSite: 'strict',
    secure: IS_PROD,
    path: '/',
  });
  next();
});

app.get('/api/v1/csrf', (req, res) => {
  const token = (req.cookies[CSRF_COOKIE] as string | undefined) || req.issuedCsrfToken;
  if (!token) {
    return res.status(500).json({ error: 'CSRF token unavailable' });
  }
  res.setHeader('X-CSRF-Token', token);
  return res.json({ token });
});

// CSRF + global rate limit on v1 and legacy /api/billing (LSA-070).
app.use('/api/v1', csrfProtection, globalApiRateLimit);
app.use('/api/billing', csrfProtection, globalApiRateLimit);

// Stripe webhook — CSRF-exempt but per-IP rate limited (LSA-074).
app.post('/api/v1/billing/webhook', billingWebhookRateLimit, forwardRawBillingWebhook);
app.post('/api/billing/webhook', billingWebhookRateLimit, forwardRawBillingWebhook);

let cachedHealth: { ok: boolean; backendOk: boolean; ts: number } | null = null;

app.get('/health', async (_req, res) => {
  const now = Date.now();
  if (cachedHealth && now - cachedHealth.ts < 5000) {
    return res.status(cachedHealth.ok ? 200 : 503).json(cachedHealth);
  }

  let backendOk = false;
  try {
    const javaBackendUrl = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';
    const resp = await axios.get(`${javaBackendUrl}/api/health`, { timeout: 3000 });
    if (resp.status === 200) {
      backendOk = true;
    }
  } catch (err) {
    console.warn('[health] Backend probe failed:', err instanceof Error ? err.message : err);
  }

  cachedHealth = {
    ok: backendOk,
    backendOk,
    ts: now,
  };

  return res.status(cachedHealth.ok ? 200 : 503).json(cachedHealth);
});

const jwksLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down — too many requests.' },
});

app.get('/.well-known/jwks.json', jwksLimiter, async (_req, res, next) => {
  try {
    const r = await forward({ method: 'GET', path: '/.well-known/jwks.json' });
    res.status(r.status);
    const cacheControl = r.headers['cache-control'];
    if (typeof cacheControl === 'string') {
      res.setHeader('cache-control', cacheControl);
    }
    res.json(r.data);
  } catch (e) {
    next(e);
  }
});

// ── Route mounting ────────────────────────────────────────────────────────────
app.use('/api/v1/auth', auth);
app.use('/api/v1/profile', profile);
app.use('/api/v1/jobs', jobs);
app.use('/api/v1/kanban', kanban);
app.use('/api/v1/skills', skills);
app.use('/api/v1/analytics', analytics);
app.use('/api/v1/notifications', notifications);
app.use('/api/v1/referrals', referrals);
app.use('/api/v1/interviews', interview);
app.use('/api/v1/planner', planner);
app.use('/api/v1/networking', networking);
app.use('/api/v1/workspaces', workspace);
app.use('/api/v1/progress', progress);
app.use('/api/v1/onboarding', onboarding);
app.use('/api/v1/experiments', experiments);
app.use('/api/v1/auto-apply', autoApply);
app.use('/api/v1/outreach', outreach);
app.use('/api/v1/watchlists', watchlists);
app.use('/api/v1/agent-memory', agentMemory);
app.use('/api/v1/resume-versions', resumeVersions);
app.use('/api/v1/cv', cv);
app.use('/api/v1/billing', billing);
// Legacy mount — same CSRF/rate-limit stack as v1; webhook handled above.
app.use('/api/billing', billing);
app.use('/api/v1/admin/saas', adminSaas);
app.use('/api/v1/usage', usage);
app.use('/api/v1/consents', consents);
app.use('/api/v1/user/consent', userConsent);
app.use('/api/v1/account', account);
app.use('/api/v1/public', publicRoutes); // Pass 6 #6.016 — unauthenticated stats

// ── Global error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const isCorsRejection = typeof err.message === 'string' && err.message.startsWith('CORS:');
  const status = isCorsRejection ? 403 : (err.status || err.response?.status || 500);
  const isDev = process.env.NODE_ENV !== 'production';
  const message = isDev
    ? (err.response?.data?.error || err.message || 'Internal error')
    : 'Internal error';

  logger.error({
    msg: 'Middleware request processing failed',
    error: err.message,
    status,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl || req.url,
    userId: (req as any).user?.id,
    correlationId: req.headers['x-correlation-id'] || req.headers['X-Correlation-Id'],
  });

  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => logger.info(`CareerOps middleware listening on :${port}`));

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(
      `Port ${port} is already in use. Stop the other middleware process ` +
        `(e.g. another "npm run dev" or "dev:stack") or set PORT to a free port.`,
    );
    process.exit(1);
  }
  throw err;
});

// 9.032 Fix: Graceful shutdown on SIGTERM / SIGINT
const shutdown = () => {
  logger.info('SIGTERM/SIGINT received. Commencing graceful shutdown...');
  server.close(() => {
    logger.info('HTTP server closed. Process exiting.');
    process.exit(0);
  });
  
  // Force shutdown after 30s
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcefully exiting.');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
