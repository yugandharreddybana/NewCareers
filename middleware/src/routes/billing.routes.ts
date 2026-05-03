import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'active',
    plan: 'Pro',
    nextBillingDate: '2026-06-01'
  });
});

export default router;
