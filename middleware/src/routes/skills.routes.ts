import express from 'express';
import { authGuard } from '../authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();

const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      res.status(502).json({ error: 'Backend unavailable', details: err.message });
    },
  },
});

// ─── Core skill endpoints ────────────────────────────────────────────────────

// Start or continue a skill run (POST /api/skills/start)
router.post('/start', authGuard, javaProxy);

// Reply to a pending conversation (POST /api/skills/reply)
router.post('/reply', authGuard, javaProxy);

// Run all skills at once (POST /api/skills/run-all)
router.post('/run-all', authGuard, javaProxy);

// PDF export — single skill or complete pack (GET /api/skills/pdf/:userJobId/:type)
router.get('/pdf/:userJobId/:type', authGuard, javaProxy);

// Get cached skill result (GET /api/skills/result/:userJobId/:skill)
router.get('/result/:userJobId/:skill', authGuard, javaProxy);

// ─── Phase 1 skill aliases (named shortcuts) ─────────────────────────────────

const phase1Skills = [
  'evaluate',
  'tailor-resume',
  'apply',
  'outreach',
  'research',
  'prep-interview',
  'compare',
  'triage',
  'scan',
];

phase1Skills.forEach((skillName) => {
  // POST /api/skills/:skillName/run  → proxied to Java /skills/start with skill injected
  router.post(`/${skillName}/run`, authGuard, (req, res, next) => {
    req.body = { ...req.body, skill: skillName };
    next();
  }, javaProxy);

  // GET /api/skills/:skillName/result/:userJobId
  router.get(`/${skillName}/result/:userJobId`, authGuard, (req, res, next) => {
    req.url = `/skills/result/${req.params.userJobId}/${skillName}`;
    next();
  }, javaProxy);
});

// ─── Phase 2 skill aliases (5 new skills) ────────────────────────────────────

const phase2Skills = [
  'salary-negotiation',
  'culture-fit',
  'linkedin-optimize',
  'cover-letter',
  'skills-gap-plan',
];

phase2Skills.forEach((skillName) => {
  router.post(`/${skillName}/run`, authGuard, (req, res, next) => {
    req.body = { ...req.body, skill: skillName };
    next();
  }, javaProxy);

  router.get(`/${skillName}/result/:userJobId`, authGuard, (req, res, next) => {
    req.url = `/skills/result/${req.params.userJobId}/${skillName}`;
    next();
  }, javaProxy);
});

// ─── CV Human Score endpoint ─────────────────────────────────────────────────
// POST /api/skills/cv-human-score  — returns ATS + human scores for tailored CV
router.post('/cv-human-score', authGuard, javaProxy);

export default router;
