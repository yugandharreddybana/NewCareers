import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';

// ── C2 fix: startup env validation ────────────────────────────────────────────────
// Fail fast at startup if critical env vars are missing instead of crashing
// at runtime when the first request hits a code path that needs them.
const REQUIRED_ENV = [
  'JWT_SECRET',
  'JAVA_BACKEND_URL',
];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`[startup] FATAL: missing required env vars: ${missingEnv.join(', ')}`);
  process.exit(1);
}

import auth          from './routes/auth.routes.js';
import profile       from './routes/profile.routes.js';
import jobs          from './routes/jobs.routes.js';
import kanban        from './routes/kanban.routes.js';
import skills        from './routes/skills.routes.js';
import analytics     from './routes/analytics.routes.js';
import notifications from './routes/notifications.routes.js';
import referrals     from './routes/referrals.routes.js';
import interview     from './routes/interview.routes.js';
import planner       from './routes/planner.routes.js';
import networking    from './routes/networking.routes.js';
import workspace     from './routes/workspace.routes.js';
import progress      from './routes/progress.routes.js';
import onboarding    from './routes/onboarding.routes.js';
import experiments   from './routes/experiments.routes.js';
import autoApply     from './routes/auto-apply.routes.js';
import outreach      from './routes/outreach.routes.js';
import watchlists    from './routes/watchlists.routes.js';
import agentMemory   from './routes/agent-memory.routes.js';
import resumeVersions from './routes/resume-versions.routes.js';
import cv            from './routes/cv.routes.js';
import billing       from './routes/billing.routes.js';

const app = express();

// ── C1 fix: CORS — supports multiple allowed origins ────────────────────────────
// ALLOWED_ORIGINS is a comma-separated list of allowed origins.
// e.g. ALLOWED_ORIGINS=https://app.careerhub.io,https://staging.careerhub.io
// Falls back to a single ALLOWED_ORIGIN or localhost for backwards compat.
const rawOrigins = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));

// Helmet with explicit Content-Security-Policy
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS, 'https://api.stripe.com'],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
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

// Stripe webhook needs raw body — must be BEFORE express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// C4 fix: morgan — use 'combined' (Apache format) in production for structured
// access logs; 'dev' (colourised short format) in development only.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── CSRF protection via double-submit cookie pattern ────────────────────────────
const CSRF_COOKIE = 'co_csrf';

app.use((req, res, next) => {
  if (!req.cookies[CSRF_COOKIE]) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
  next();
});

app.use('/api', (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();
  if (req.path.startsWith('/billing/webhook')) return next();

  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  next();
});

// ── C3 fix: global rate limiter keyed per user (not per IP) ────────────────────
// The old flat IP-based limiter meant one user on a shared NAT (office, uni)
// could exhaust the limit for everyone on the same IP.
// Now: authenticated requests are keyed by JWT userId extracted from the
// Authorization header; unauthenticated requests fall back to IP.
app.use('/api', rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Extract userId from Bearer token if present (no full JWT verify —
    // that’s authGuard’s job; we just need a stable per-user key here).
    try {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        const payload = JSON.parse(
          Buffer.from(auth.split('.')[1], 'base64url').toString()
        );
        if (payload?.sub) return `user:${payload.sub}`;
      }
    } catch { /* fall through to IP */ }
    return req.ip ?? 'unknown';
  },
}));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Route mounting ────────────────────────────────────────────────────────────
app.use('/api/auth',            auth);
app.use('/api/profile',         profile);
app.use('/api/jobs',            jobs);
app.use('/api/kanban',          kanban);
app.use('/api/skills',          skills);
app.use('/api/analytics',       analytics);
app.use('/api/notifications',   notifications);
app.use('/api/referrals',       referrals);
app.use('/api/interviews',      interview);
app.use('/api/planner',         planner);
app.use('/api/networking',      networking);
app.use('/api/workspaces',      workspace);
app.use('/api/progress',        progress);
app.use('/api/onboarding',      onboarding);
app.use('/api/experiments',     experiments);
app.use('/api/auto-apply',      autoApply);
app.use('/api/outreach',        outreach);
app.use('/api/watchlists',      watchlists);
app.use('/api/agent-memory',    agentMemory);
app.use('/api/resume-versions', resumeVersions);
app.use('/api/cv',              cv);
app.use('/api/billing',         billing);

// ── Global error handler ─────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Middleware error:', err.message);
  const status = err.status || err.response?.status || 500;
  res.status(status).json({
    error: err.response?.data?.error || err.message || 'Internal error'
  });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`CareerOps middleware listening on :${port}`));
