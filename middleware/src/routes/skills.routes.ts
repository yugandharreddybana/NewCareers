/**
 * skills.routes.ts — AI skill execution endpoints
 *
 * C6b fix (Batch 3 carry-over from Batch 6 audit): skillLimiter was defined
 * in rateLimiter.ts (30 calls/min) but was never applied to any skill route.
 * All write/run endpoints now enforce it to prevent runaway AI cost.
 */
import express from 'express';
import { authGuard } from '../authGuard.js';
import { skillLimiter } from '../rateLimiter.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();

const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  proxyTimeout: 60_000,
  timeout: 60_000,
  on: {
    error: (err, _req, res) => {
      res.status(502).json({ error: 'Backend unavailable', details: err.message });
    },
  },
});

// ── Core skill endpoints ──────────────────────────────────────────────────────────

// POST /api/skills/start — start or continue a skill run
router.post('/start',   authGuard, skillLimiter, javaProxy);

// POST /api/skills/reply — reply to a pending conversation
router.post('/reply',   authGuard, skillLimiter, javaProxy);

// POST /api/skills/run-all — run all skills at once
router.post('/run-all', authGuard, skillLimiter, javaProxy);

// POST /api/skills/cv-human-score
router.post('/cv-human-score', authGuard, skillLimiter, javaProxy);

// GET endpoints are read-only — no rate limit needed beyond the global 200/min
router.get('/pdf/:userJobId/:type',     authGuard, javaProxy);
router.get('/result/:userJobId/:skill', authGuard, javaProxy);

// ── Phase 1 skill aliases ────────────────────────────────────────────────────────
const phase1Skills = [
  'evaluate', 'tailor-resume', 'apply', 'outreach',
  'research', 'prep-interview', 'compare', 'triage', 'scan',
];

phase1Skills.forEach((skillName) => {
  router.post(`/${skillName}/run`, authGuard, skillLimiter, (req, _res, next) => {
    req.body = { ...req.body, skill: skillName };
    next();
  }, javaProxy);

  router.get(`/${skillName}/result/:userJobId`, authGuard, (req, _res, next) => {
    req.url = `/skills/result/${req.params.userJobId}/${skillName}`;
    next();
  }, javaProxy);
});

// ── Phase 2 skill aliases ────────────────────────────────────────────────────────
const phase2Skills = [
  'salary-negotiation', 'culture-fit',
  'linkedin-optimize', 'cover-letter', 'skills-gap-plan',
];

phase2Skills.forEach((skillName) => {
  router.post(`/${skillName}/run`, authGuard, skillLimiter, (req, _res, next) => {
    req.body = { ...req.body, skill: skillName };
    next();
  }, javaProxy);

  router.get(`/${skillName}/result/:userJobId`, authGuard, (req, _res, next) => {
    req.url = `/skills/result/${req.params.userJobId}/${skillName}`;
    next();
  }, javaProxy);
});

export default router;
