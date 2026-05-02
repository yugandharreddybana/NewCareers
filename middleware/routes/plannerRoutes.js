/**
 * Task 25 — Middleware planner routes.
 * Proxies all /planner/* requests to the Java backend.
 * Enforces JWT auth on every route.
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const BACKEND_URL = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const proxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  pathRewrite: { '^/planner': '/api/planner' },
  on: {
    error: (err, req, res) => {
      console.error('[plannerRoutes] Proxy error:', err.message);
      res.status(502).json({ error: 'Backend unavailable', detail: err.message });
    },
  },
});

// All routes require a valid JWT
router.use(authenticateToken);

// Task 22 — Generate plan for a job
router.post('/generate/:userJobId', proxy);

// Task 23 — Update (complete) a task
router.patch('/task/:taskId', proxy);

// Task 24 — Upcoming tasks
router.get('/upcoming', proxy);

// Tasks for a specific job
router.get('/tasks/:userJobId', proxy);

// Deadlines for a specific job
router.get('/deadlines/:userJobId', proxy);
router.post('/deadlines/:userJobId', proxy);

// Upcoming deadlines across all jobs
router.get('/deadlines/upcoming', proxy);

module.exports = router;
