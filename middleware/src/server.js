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
import notifications from './routes/notifications.routes.js';
import referrals     from './routes/referrals.routes.js';
import interview     from './routes/interview.routes.js';       // 3.1
import planner       from './routes/planner.routes.js';         // 3.2
import networking    from './routes/networking.routes.js';      // 3.3
import workspace     from './routes/workspace.routes.js';       // 3.4
import progress      from './routes/progress.routes.js';        // 3.5
import onboarding   from './routes/onboarding.routes.js';      // 3.6
import experiments  from './routes/experiments.routes.js';     // 3.6

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth',          auth);
app.use('/api/profile',       profile);
app.use('/api/jobs',          jobs);
app.use('/api/kanban',        kanban);
app.use('/api/skills',        skills);
app.use('/api/analytics',     analytics);
app.use('/api/notifications', notifications);
app.use('/api/referrals',     referrals);
app.use('/api/interviews',    interview);      // 3.1
app.use('/api/planner',       planner);        // 3.2
app.use('/api/networking',    networking);     // 3.3
app.use('/api/workspaces',    workspace);      // 3.4
app.use('/api/progress',      progress);       // 3.5
app.use('/api/onboarding',    onboarding);     // 3.6
app.use('/api/experiments',   experiments);    // 3.6

app.use((err, _req, res, _next) => {
  console.error('Middleware error:', err.message);
  const status = err.status || err.response?.status || 500;
  res.status(status).json({
    error: err.response?.data?.error || err.message || 'Internal error'
  });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`CareerOps middleware listening on :${port}`));
