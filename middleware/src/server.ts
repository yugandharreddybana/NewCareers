import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';

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
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

// ── Fix #11: Helmet with explicit Content-Security-Policy ─────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ALLOWED_ORIGIN, 'https://api.stripe.com'],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  // Additional security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true
}));

// Stripe webhook needs raw body — must be BEFORE express.json()
// (billing.routes.ts handles the raw body parsing for /webhook)
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── Fix #10: CSRF protection via double-submit cookie pattern ─────────────
// Issue a CSRF token cookie on every request; state-mutating endpoints
// require the client to echo it back in the X-CSRF-Token header.
const CSRF_COOKIE = 'co_csrf';

app.use((req, res, next) => {
  // Set CSRF cookie if not present
  if (!req.cookies[CSRF_COOKIE]) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,   // must be readable by JS to send as header
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
  next();
});

// Verify CSRF token on state-mutating methods
app.use('/api', (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();

  // Skip CSRF for Stripe webhooks (they have their own signature verification)
  if (req.path.startsWith('/billing/webhook')) return next();

  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  next();
});

app.use('/api', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Route mounting ────────────────────────────────────────────────────────
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

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Middleware error:', err.message);
  const status = err.status || err.response?.status || 500;
  res.status(status).json({
    error: err.response?.data?.error || err.message || 'Internal error'
  });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`CareerOps middleware listening on :${port}`));
