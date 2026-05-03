/**
 * billing.routes.ts — billing / subscription management
 *
 * Proxies all billing requests to the Java backend which handles
 * Stripe integration (webhook verification, customer portal, etc.).
 */
import express from 'express';
import { authGuard, requireRole } from '../authGuard.js';
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
      res.status(502).json({ error: 'Billing service unavailable', details: err.message });
    },
  },
});

// GET    /api/billing                       → current subscription status
router.get('/',                           authGuard, javaProxy);

// GET    /api/billing/plans                 → list available plans
router.get('/plans',                      authGuard, javaProxy);

// POST   /api/billing/checkout              → create Stripe checkout session
router.post('/checkout',                  authGuard, javaProxy);

// POST   /api/billing/portal                → create Stripe customer portal session
router.post('/portal',                    authGuard, javaProxy);

// GET    /api/billing/invoices              → list past invoices
router.get('/invoices',                   authGuard, javaProxy);

// GET    /api/billing/usage                 → current period usage metrics
router.get('/usage',                      authGuard, javaProxy);

// POST   /api/billing/cancel                → cancel subscription at period end
router.post('/cancel',                    authGuard, javaProxy);

// POST   /api/billing/reactivate            → reactivate a cancelled subscription
router.post('/reactivate',                authGuard, javaProxy);

// POST   /api/billing/webhook               → Stripe webhook handler (no auth guard — Stripe signs these)
router.post('/webhook', express.raw({ type: 'application/json' }), javaProxy);

export default router;
