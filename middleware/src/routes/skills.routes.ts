import express from 'express';
import { authGuard } from '../authGuard.js';
import { skillLimiter } from '../rateLimiter.js';
import { proxyMiddleware } from '../services/backendProxy.js';
import { body } from 'express-validator';
import { checkValidation } from '../sanitize.js';

const router = express.Router();

const javaProxy = proxyMiddleware();

// ── Core skill endpoints ──────────────────────────────────────────────────────────

// POST /api/skills/start — start or continue a skill run
router.post('/start',
  authGuard, skillLimiter,
  body('userJobId').optional({ values: 'null' }),
  body('skillName').notEmpty().withMessage('skillName is required'),
  checkValidation,
  javaProxy
);

// POST /api/skills/reply — reply to a pending conversation
router.post('/reply',
  authGuard, skillLimiter,
  body('userJobId').exists().withMessage('userJobId is required'),
  body('message').isString().trim().notEmpty().withMessage('message must be a non-empty string'),
  checkValidation,
  javaProxy
);

// POST /api/skills/run-all — run all skills at once
router.post('/run-all',
  authGuard, skillLimiter,
  body('userJobId').exists().withMessage('userJobId is required'),
  checkValidation,
  javaProxy
);

// POST /api/skills/cv-human-score
router.post('/cv-human-score',
  authGuard, skillLimiter,
  body('userJobId').exists().withMessage('userJobId is required'),
  checkValidation,
  javaProxy
);

// GET endpoints are read-only — no rate limit needed beyond the global 200/min
router.get('/pdf/:userJobId/:type',     authGuard, javaProxy);
router.post('/pdf/evaluation-report',   authGuard, javaProxy);
router.get('/result/:userJobId/:skill', authGuard, javaProxy);

// Align with Java SkillsController paths used by the frontend
router.post('/conversation/reply',      authGuard, skillLimiter, javaProxy);
router.get('/last-run/:userJobId/:skillName', authGuard, javaProxy);
router.post('/run-all/:userJobId',      authGuard, skillLimiter, javaProxy);
router.post('/run-all-async/:userJobId', authGuard, skillLimiter, javaProxy);
router.get('/run-all/:batchId/status',  authGuard, javaProxy);

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
