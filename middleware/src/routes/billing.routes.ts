/**
 * billing.routes.ts — Stripe billing proxy to Java backend
 */
import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const proxy = createJavaRouteProxy('/billing');

router.post('/checkout-session', authGuard, proxy);
router.post('/checkout', authGuard, proxy);
router.post('/customer-portal', authGuard, proxy);
router.post('/portal', authGuard, proxy);
router.get('/subscription', authGuard, proxy);
router.get('/', authGuard, proxy);
router.get('/plans', proxy);
router.get('/invoices', authGuard, proxy);
router.get('/usage', authGuard, proxy);
router.post('/cancel', authGuard, proxy);
router.post('/reactivate', authGuard, proxy);
router.put('/organization', authGuard, proxy);

// Webhook is registered in server.ts with per-IP rate limiting (LSA-074).

router.use((req, res) => {
  res.status(404).json({
    error: `Unknown billing route: ${req.method} ${req.path}`,
    code: 'BILLING_ROUTE_NOT_FOUND',
  });
});

export default router;
