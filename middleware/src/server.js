import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import auth          from './routes/auth.routes.js';
import profile       from './routes/profile.routes.js';
import jobs          from './routes/jobs.routes.js';
import kanban        from './routes/kanban.routes.js';
import skills        from './routes/skills.routes.js';
import analytics     from './routes/analytics.routes.js';
import notifications from './routes/notifications.routes.js';  // Section 8
import referrals     from './routes/referrals.routes.js';       // Section 9
import interview     from './routes/interview.routes.js';       // Phase 3 — Task 13

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Global API rate limit (auth has its own stricter limit)
app.use('/api', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth',          auth);
app.use('/api/profile',       profile);
app.use('/api/jobs',          jobs);
app.use('/api/kanban',        kanban);
app.use('/api/skills',        skills);
app.use('/api/analytics',     analytics);
app.use('/api/notifications', notifications);  // Section 8 — Task 83
app.use('/api/referrals',     referrals);       // Section 9 — Task 98
app.use('/api/interview',     interview);       // Phase 3 — Task 13

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('Middleware error:', err.message);
  const status = err.status || err.response?.status || 500;
  res.status(status).json({
    error: err.response?.data?.error || err.message || 'Internal error'
  });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`CareerOps middleware listening on :${port}`));
