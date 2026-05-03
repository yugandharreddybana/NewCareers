import express from 'express';
import { authGuard } from '../authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();

const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
  on: {
    error: (err, _req, res) => {
      res.status(502).json({ error: 'Backend unavailable', details: err.message });
    },
  },
});

// GET    /api/resume-versions              → list all versions
router.get('/',                authGuard, javaProxy);

// POST   /api/resume-versions              → create version
router.post('/',               authGuard, javaProxy);

// GET    /api/resume-versions/compare/:leftId/:rightId → compare two versions
router.get('/compare/:leftId/:rightId', authGuard, javaProxy);

// GET    /api/resume-versions/recommend    → recommend best version
router.get('/recommend',       authGuard, javaProxy);

// GET    /api/resume-versions/:id          → get single version
router.get('/:id',             authGuard, javaProxy);

// PUT    /api/resume-versions/:id          → update version
router.put('/:id',             authGuard, javaProxy);

// POST   /api/resume-versions/:id/outcome  → record outcome
router.post('/:id/outcome',    authGuard, javaProxy);

// DELETE /api/resume-versions/:id          → delete version
router.delete('/:id',          authGuard, javaProxy);

export default router;
