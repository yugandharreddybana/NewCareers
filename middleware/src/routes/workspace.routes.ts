// Section 3.4 — workspace collaboration routes (tasks 49-53)
import express from 'express';
import { verifyToken } from '../auth.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const proxy = createJavaRouteProxy('/workspaces', {
  errorMessage: 'Workspace service unavailable.',
});

router.post('/',              verifyToken, proxy); // Task 49 — create workspace
router.post('/:id/invite',    verifyToken, proxy); // Task 50 — invite member
router.get('/:id',            verifyToken, proxy); // Task 51 — get workspace
router.post('/:id/notes',     verifyToken, proxy); // Task 52 — add note
router.get('/:id/notes',      verifyToken, proxy); // Task 52 — list notes
router.post('/invite/accept', verifyToken, proxy); // accept invite token
router.get('/',               verifyToken, proxy); // list user workspaces

export default router;
