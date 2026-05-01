const express = require('express');
const router  = express.Router();
const { authGuard } = require('../middleware/authGuard');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { rateLimit } = require('express-rate-limit');

const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: {
    error: (err, _req, res) => {
      res.status(502).json({ error: 'Backend unavailable', details: err.message });
    },
  },
});

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

module.exports = router;
