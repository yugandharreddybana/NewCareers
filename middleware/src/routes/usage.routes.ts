import express from 'express';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();
router.use(authGuard);

router.get('/limits', async (req, res, next) => {
  try {
    const r = await forward({ path: '/usage/limits', userId: req.userId });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.get('/tokens', async (req, res, next) => {
  try {
    const r = await forward({ path: '/usage/tokens', userId: req.userId });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

export default router;
