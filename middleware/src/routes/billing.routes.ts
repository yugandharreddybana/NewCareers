/**
 * billing.routes.ts — billing / subscription management coming-soon handler
 *
 * Implements a clean 501 Not Implemented fallback for all billing endpoints.
 * Avoids proxying to a non-existent backend controller and returning 502/404.
 */
import express from 'express';
import { authGuard } from '../authGuard.js';

const router = express.Router();

const handleComingSoon = (_req: express.Request, res: express.Response) => {
  res.status(501).json({ error: 'Billing services are not yet configured on this server.' });
};

// GET    /api/billing                       → current subscription status
router.get('/',                           authGuard, handleComingSoon);

// GET    /api/billing/plans                 → list available plans
router.get('/plans',                      authGuard, handleComingSoon);

// POST   /api/billing/checkout              → create Stripe checkout session
router.post('/checkout',                  authGuard, handleComingSoon);

// POST   /api/billing/portal                → create Stripe customer portal session
router.post('/portal',                    authGuard, handleComingSoon);

// GET    /api/billing/invoices              → list past invoices
router.get('/invoices',                   authGuard, handleComingSoon);

// GET    /api/billing/usage                 → current period usage metrics
router.get('/usage',                      authGuard, handleComingSoon);

// POST   /api/billing/cancel                → cancel subscription at period end
router.post('/cancel',                    authGuard, handleComingSoon);

// POST   /api/billing/reactivate            → reactivate a cancelled subscription
router.post('/reactivate',                authGuard, handleComingSoon);

// POST   /api/billing/webhook               → Stripe webhook handler
router.post('/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (endpointSecret && !sig) {
    return res.status(401).json({ error: 'Stripe signature verification failed: Missing stripe-signature header' });
  }
  
  // Since billing is disabled on this server, return 501 Not Implemented
  res.status(501).json({ error: 'Billing services are not yet configured on this server.' });
});

export default router;
