import express from 'express';
import { authGuard } from '../middleware/auth.js';
import { proxyPost, proxyGet } from '../utils/proxy.js';

const router = express.Router();

// POST /api/referrals — create referral + send invite email (auth required)
router.post('/', authGuard, proxyPost('/referrals'));

// GET /api/referrals/my — list my referrals + stats (auth required)
router.get('/my', authGuard, proxyGet('/referrals/my'));

// GET /api/referrals/validate/:token — public, called on signup page pre-auth
router.get('/validate/:token', proxyGet('/referrals/validate/:token', { passParams: ['token'] }));

export default router;
