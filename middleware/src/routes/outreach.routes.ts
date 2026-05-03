import express from 'express';
import { authGuard } from '../authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();
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

// GET    /api/outreach/campaigns              → list campaigns
router.get('/campaigns',                   authGuard, javaProxy);

// POST   /api/outreach/campaigns              → create campaign
router.post('/campaigns',                  authGuard, javaProxy);

// GET    /api/outreach/campaigns/:id          → campaign detail
router.get('/campaigns/:id',               authGuard, javaProxy);

// POST   /api/outreach/campaigns/:id/launch   → launch campaign
router.post('/campaigns/:id/launch',       authGuard, javaProxy);

// DELETE /api/outreach/campaigns/:id          → delete campaign
router.delete('/campaigns/:id',            authGuard, javaProxy);

// POST   /api/outreach/campaigns/:id/sequences → add sequence step
router.post('/campaigns/:id/sequences',   authGuard, javaProxy);

// POST   /api/outreach/campaigns/:id/messages  → add message
router.post('/campaigns/:id/messages',    authGuard, javaProxy);

// PATCH  /api/outreach/messages/:messageId     → update message status
router.patch('/messages/:messageId',                  authGuard, javaProxy);

// PATCH  /api/outreach/messages/:messageId/unsubscribe → unsubscribe contact
router.patch('/messages/:messageId/unsubscribe',      authGuard, javaProxy);

// GET    /api/outreach/campaigns/:id/send-time → send time suggestion
router.get('/campaigns/:id/send-time',                authGuard, javaProxy);

export default router;
