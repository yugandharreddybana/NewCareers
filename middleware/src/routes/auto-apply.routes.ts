import express from 'express';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const javaProxy = createJavaRouteProxy('/applications/auto');

// GET    /api/auto-apply/answers           → list answer bank
router.get('/answers',              authGuard, javaProxy);

// POST   /api/auto-apply/answers           → upsert answer
router.post('/answers',             authGuard, javaProxy);

// DELETE /api/auto-apply/answers/:id       → delete answer
router.delete('/answers/:id',       authGuard, javaProxy);

// GET    /api/auto-apply/history           → list all runs
router.get('/history',              authGuard, javaProxy);

// GET    /api/auto-apply/status/:runId     → run detail + steps
router.get('/status/:runId',        authGuard, javaProxy);

// POST   /api/auto-apply/start/:userJobId  → start new run
router.post('/start/:userJobId',    authGuard, javaProxy);

// POST   /api/auto-apply/approve/:runId    → approve or cancel run
router.post('/approve/:runId',      authGuard, javaProxy);

// POST   /api/auto-apply/retry/:runId      → retry a failed run
router.post('/retry/:runId',        authGuard, javaProxy);

export default router;
