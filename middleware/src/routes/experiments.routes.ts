/**
 * experiments.routes.ts — A/B experiment variant + admin proxy routes
 */
import express from 'express';
import { authGuard, requireRole } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const proxy = createJavaRouteProxy('/experiments', {
  errorMessage: 'Experiment service unavailable.',
});

router.get('/variants', authGuard, proxy);
router.get('/variant/:key', authGuard, proxy);

router.get('/admin/results', authGuard, requireRole('ADMIN'), proxy);
router.post('/admin', authGuard, requireRole('ADMIN'), proxy);
router.patch('/admin/:id/status', authGuard, requireRole('ADMIN'), proxy);

export default router;
