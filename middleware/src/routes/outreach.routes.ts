/**
 * outreach.routes.ts — outreach campaigns, sequences, messages
 *
 * Fixed: missing GET /templates route — the OutreachPage UI has a
 * "Use Template" flow that calls /api/outreach/templates, but no
 * route existed, returning 404 on every template load.
 *
 * Also added POST /templates and DELETE /templates/:id for full
 * template lifecycle management.
 */
import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const javaProxy = createJavaRouteProxy('/outreach');

// ── Templates (new — was missing entirely) ────────────────────────────────
// GET    /api/outreach/templates              → list message templates
router.get('/templates',                    authGuard, javaProxy);

// POST   /api/outreach/templates              → create template
router.post('/templates',                   authGuard, javaProxy);

// DELETE /api/outreach/templates/:id          → delete template
router.delete('/templates/:id',             authGuard, javaProxy);

// ── Campaigns ───────────────────────────────────────────────────────────────
// GET    /api/outreach/campaigns              → list campaigns
router.get('/campaigns',                    authGuard, javaProxy);

// POST   /api/outreach/campaigns              → create campaign
router.post('/campaigns',                   authGuard, javaProxy);

// GET    /api/outreach/campaigns/:id          → campaign detail
router.get('/campaigns/:id',                authGuard, javaProxy);

// POST   /api/outreach/campaigns/:id/launch   → launch campaign
router.post('/campaigns/:id/launch',        authGuard, javaProxy);

// DELETE /api/outreach/campaigns/:id          → delete campaign
router.delete('/campaigns/:id',             authGuard, javaProxy);

// POST   /api/outreach/campaigns/:id/sequences → add sequence step
router.post('/campaigns/:id/sequences',     authGuard, javaProxy);

// POST   /api/outreach/campaigns/:id/messages  → add message to campaign
router.post('/campaigns/:id/messages',      authGuard, javaProxy);

// ── Individual message actions ──────────────────────────────────────────
// PATCH  /api/outreach/messages/:messageId            → update message status
router.patch('/messages/:messageId',                  authGuard, javaProxy);

// PATCH  /api/outreach/messages/:messageId/unsubscribe → unsubscribe contact
router.patch('/messages/:messageId/unsubscribe',      authGuard, javaProxy);

// ── Utilities ──────────────────────────────────────────────────────────────
// GET    /api/outreach/campaigns/:id/send-time → AI-suggested best send time
router.get('/campaigns/:id/send-time',                authGuard, javaProxy);

export default router;
