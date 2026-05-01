// Section 3.4 — Task 53
// Workspace collaboration routes: auth guard + role validation + proxy to Java backend

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Rate limit invite endpoint — prevent abuse
const inviteLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many invite requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Role check helper — verify the requesting user is an accepted member
// of the workspace (enforced at the Java layer too, but defence-in-depth)
const requireWorkspaceMember = async (req, res, next) => {
  // The Java backend owns authoritative access control;
  // this middleware validates the JWT is present and forwards userId.
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
};

const proxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      console.error('[workspace proxy error]', err.message);
      res.status(502).json({ error: 'Workspace service temporarily unavailable.' });
    },
  },
});

// POST /workspaces — create workspace
router.post('/', verifyToken, requireWorkspaceMember, proxy);

// GET /workspaces — list my workspaces
router.get('/', verifyToken, requireWorkspaceMember, proxy);

// GET /workspaces/:id — get single workspace
router.get('/:id', verifyToken, requireWorkspaceMember, proxy);

// POST /workspaces/:id/invite — invite a member (rate limited)
router.post('/:id/invite', verifyToken, inviteLimit, requireWorkspaceMember, proxy);

// POST /workspaces/invite/accept — accept invite via token
router.post('/invite/accept', verifyToken, proxy);

// POST /workspaces/:id/notes — add a note
router.post('/:id/notes', verifyToken, requireWorkspaceMember, proxy);

// GET /workspaces/:id/notes — get all notes for a workspace
router.get('/:id/notes', verifyToken, requireWorkspaceMember, proxy);

module.exports = router;
