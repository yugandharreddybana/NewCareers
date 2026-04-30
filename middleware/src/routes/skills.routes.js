import express from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';
import { skillLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// authGuard validates JWT and attaches req.userId on every skills route
// skillLimiter enforces per-user rate limit on skill runs
router.use(authGuard, skillLimiter);

// ================================================================
// START ANY SKILL  ─  POST /api/skills/start
// Body: { skillName, userJobId, channel?, tone?, step?,
//         compareJobIds?, scanTarget? }
// Replaces: /evaluate /tailor-resume /research /outreach /apply
//           /prep-interview /compare /triage (all now deleted)
// ================================================================
router.post('/start', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: '/skills/start',
      userId: req.userId,
      data: req.body,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ================================================================
// REPLY TO CLAUDE'S QUESTION  ─  POST /api/skills/conversation/reply
// Body: { conversationId, answer }
// ================================================================
router.post('/conversation/reply', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: '/skills/conversation/reply',
      userId: req.userId,
      data: req.body,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ================================================================
// RUN ALL 9 SKILLS  ─  POST /api/skills/run-all/:userJobId
// ================================================================
router.post('/run-all/:userJobId', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: `/skills/run-all/${req.params.userJobId}`,
      userId: req.userId,
      data: {},
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ================================================================
// GET LAST RUN (no re-execution)  ─  GET /api/skills/last-run/:userJobId/:skillName
// ================================================================
router.get('/last-run/:userJobId/:skillName', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'GET',
      path: `/skills/last-run/${req.params.userJobId}/${req.params.skillName}`,
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ================================================================
// PDF DOWNLOADS
// GET /api/skills/pdf/:userJobId/:skillName  ─ single skill PDF
// GET /api/skills/pdf/:userJobId/all         ─ complete career pack PDF
// GET /api/skills/pdf/:userJobId/resume      ─ tailored resume PDF
// ================================================================
router.get('/pdf/:userJobId/all', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'GET',
      path: `/skills/pdf/${req.params.userJobId}/all`,
      userId: req.userId,
      responseType: 'arraybuffer',
    });
    // Pipe PDF bytes directly — bypass bubble() which wraps in JSON
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="careerops-complete-pack.pdf"');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(r.data));
  } catch (e) { next(e); }
});

router.get('/pdf/:userJobId/resume', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'GET',
      path: `/skills/pdf/${req.params.userJobId}/resume`,
      userId: req.userId,
      responseType: 'arraybuffer',
    });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="tailored-resume.pdf"');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(r.data));
  } catch (e) { next(e); }
});

router.get('/pdf/:userJobId/:skillName', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'GET',
      path: `/skills/pdf/${req.params.userJobId}/${req.params.skillName}`,
      userId: req.userId,
      responseType: 'arraybuffer',
    });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition',
      `attachment; filename="${req.params.skillName}-report.pdf"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(r.data));
  } catch (e) { next(e); }
});

// ================================================================
// LEGACY ALIASES  ─  kept for backward compat during migration
// All delegate to /skills/start on the Java backend.
// Remove in Phase 2 once frontend is fully migrated.
// ================================================================
const legacySkillRoutes = [
  { path: '/evaluate',      skillName: 'evaluate'      },
  { path: '/tailor-resume', skillName: 'tailor-resume' },
  { path: '/research',      skillName: 'research'      },
  { path: '/outreach',      skillName: 'outreach'      },
  { path: '/apply',         skillName: 'apply'         },
  { path: '/prep-interview', skillName: 'prep-interview' },
  { path: '/compare',       skillName: 'compare'       },
  { path: '/triage',        skillName: 'triage'        },
  { path: '/scan',          skillName: 'scan'          },
];

for (const { path, skillName } of legacySkillRoutes) {
  router.post(path, async (req, res, next) => {
    try {
      const body = {
        skillName,
        ...req.body,
        // Map legacy field names → new unified fields
        compareJobIds: req.body.userJobIds ?? req.body.compareJobIds,
      };
      const r = await forward({
        method: 'POST',
        path: '/skills/start',
        userId: req.userId,
        data: body,
      });
      bubble(r, res);
    } catch (e) { next(e); }
  });
}

// Legacy /last → new /last-run
router.get('/last', async (req, res, next) => {
  try {
    const { userJobId, skill } = req.query;
    const r = await forward({
      method: 'GET',
      path: `/skills/last-run/${userJobId}/${skill}`,
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
