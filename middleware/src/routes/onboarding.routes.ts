// Section 3.6 Tasks 69-74 — onboarding analytics + checklist proxy routes
import express from 'express';
import { verifyToken } from '../auth.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const proxy = createJavaRouteProxy('/onboarding', {
  errorMessage: 'Onboarding service unavailable.',
});

// GET /onboarding/checklist — completed steps for FirstApplicationChecklist
router.get('/checklist', verifyToken, proxy);

// POST /onboarding/event — track step completion from backend services
router.post('/event', verifyToken, proxy);

// Track A — first-run job delivery (CV → scrape → evaluate)
router.post('/delivery/start', verifyToken, proxy);
router.get('/delivery/status', verifyToken, proxy);

export default router;
