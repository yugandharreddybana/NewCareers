/**
 * billing.routes.ts — Stripe billing proxy to Java backend
 */
import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy, forwardRawBillingWebhook } from '../services/backendProxy.js';

const router = express.Router();
const proxy = createJavaRouteProxy('/billing');

const handleComingSoon = (_req: express.Request, res: express.Response) => {
  res.status(501).json({ error: 'Billing services are not yet configured on this server.' });
};

router.post('/checkout-session', authGuard, proxy);
router.post('/customer-portal', authGuard, proxy);
router.get('/subscription', authGuard, proxy);

// Legacy / future endpoints — still not implemented in Java
router.get('/', authGuard, handleComingSoon);
router.get('/plans', authGuard, handleComingSoon);
router.post('/checkout', authGuard, handleComingSoon);
router.post('/portal', authGuard, handleComingSoon);
router.get('/invoices', authGuard, handleComingSoon);
router.get('/usage', authGuard, handleComingSoon);
router.post('/cancel', authGuard, handleComingSoon);
router.post('/reactivate', authGuard, handleComingSoon);

router.post('/webhook', forwardRawBillingWebhook);

export default router;
