import express from 'express';
import { authGuard } from '../middleware/authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();

// POST /api/referrals — create referral + send invite email
router.post('/', authGuard, async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST',
      path: '/referrals',
      userId: req.userId,
      data: req.body,
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

// GET /api/referrals/my — current user's referrals + stats
router.get('/my', authGuard, async (req, res, next) => {
  try {
    const r = await forward({
      path: '/referrals/my',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

// GET /api/referrals/validate/:token — public token validation
router.get('/validate/:token', async (req, res, next) => {
  try {
    const r = await forward({
      path: `/referrals/validate/${req.params.token}`,
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

export default router;
