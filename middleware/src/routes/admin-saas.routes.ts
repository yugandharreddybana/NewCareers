/**
 * admin-saas.routes.ts — SaaS admin dashboard proxy to Java backend
 */
import express from 'express';
import { authGuard, requireRole } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const proxy = createJavaRouteProxy('/admin/saas');
const adminOnly = [authGuard, requireRole('ADMIN'), proxy] as const;

router.get('/metrics', ...adminOnly);
router.get('/subscriptions', ...adminOnly);
router.post('/subscriptions/:orgId/override-plan', ...adminOnly);
router.get('/feature-flags', ...adminOnly);
router.post('/feature-flags/:id/toggle', ...adminOnly);
router.get('/ai-usage', ...adminOnly);

export default router;
