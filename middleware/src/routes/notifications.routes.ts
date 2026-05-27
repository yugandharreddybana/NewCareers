/**
 * Notification routes — proxy to Java NotificationController.
 */
import express from 'express';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();
router.use(authGuard);

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
  } catch (e) {
    next(e);
  }
});

router.get('/unread-count', async (req, res, next) => {
  try {
    const r = await forward({
      path: '/notifications/unread-count',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.patch('/mark-all-read', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'PATCH',
      path: '/notifications/mark-all-read',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'PATCH',
      path: `/notifications/${req.params.id}/read`,
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'DELETE',
      path: '/notifications',
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) {
    next(e);
  }
});

export default router;
