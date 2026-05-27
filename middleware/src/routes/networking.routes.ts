import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
const javaProxy = createJavaRouteProxy('/networking');

// Stricter rate-limit for contact creation
const contactCreateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down' },
});

// ── Contacts ──────────────────────────────────────────────────────────────
// POST /api/networking/contact              → create contact
router.post('/contact', authGuard, contactCreateLimit, javaProxy);

// GET  /api/networking/contacts             → list contacts (?type=recruiter etc.)
router.get('/contacts', authGuard, javaProxy);

// GET  /api/networking/contacts/overdue     → overdue follow-ups (must be before /:id)
router.get('/contacts/overdue', authGuard, javaProxy);

// GET  /api/networking/contact/:id          → single contact
router.get('/contact/:id', authGuard, javaProxy);

// PUT  /api/networking/contact/:id          → update contact
router.put('/contact/:id', authGuard, javaProxy);

// DELETE /api/networking/contact/:id        → delete contact
router.delete('/contact/:id', authGuard, javaProxy);

// ── Interactions ──────────────────────────────────────────────────────────
// POST /api/networking/contact/:id/log-interaction → log an interaction
router.post('/contact/:id/log-interaction', authGuard, javaProxy);

// GET  /api/networking/contact/:id/interactions   → history for a contact
router.get('/contact/:id/interactions', authGuard, javaProxy);

// ── Task 43 — CSV import ──────────────────────────────────────────────────
// POST /api/networking/contacts/import  → multipart CSV upload
router.post('/contacts/import', authGuard, javaProxy);

export default router;
