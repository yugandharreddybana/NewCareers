/**
 * Section 8 — Task 83
 * Notification routes.
 *
 * GET    /api/notifications            — paginated list + unread count
 * PATCH  /api/notifications/read-all  — mark ALL read  (must be before /:id/read)
 * PATCH  /api/notifications/:id/read  — mark one read
 * DELETE /api/notifications            — clear all
 */

import express from 'express';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();
router.use(authGuard);

// GET /api/notifications?page=0&size=20
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(0, Number(req.query.page) || 0);
    const size = Math.max(1, Math.min(50, Number(req.query.size) || 20));
    const r = await forward({
      path: '/notifications',
      userId: req.userId,
      params: { page, size },
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// PATCH /api/notifications/read-all
// MUST be declared before /:id/read so the literal string
// "read-all" is not parsed as a UUID.
router.patch('/read-all', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'PATCH',
      path: '/notifications/read-all',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'PATCH',
      path: `/notifications/${req.params.id}/read`,
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// DELETE /api/notifications
router.delete('/', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'DELETE',
      path: '/notifications',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
