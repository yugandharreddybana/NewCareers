/**
 * resume-versions.routes.ts — resume version management
 *
 * Fixed: missing POST /upload route — the ResumeVersionsPage UI has a file
 * upload flow but there was no multipart upload endpoint in the middleware.
 * Added multer with PDF/DOCX validation (same config as cv.routes.ts)
 * before proxying to Java for storage + parsing.
 */
import express from 'express';
import multer from 'multer';
import { authGuard } from '../authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();

const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

// Multer: 10 MB max, PDF/DOCX only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const javaProxy = createProxyMiddleware({
  target: JAVA,
  changeOrigin: true,
  proxyTimeout: 60_000,
  timeout: 60_000,
  on: {
    error: (err, _req, res) => {
      res.status(502).json({ error: 'Backend unavailable', details: err.message });
    },
  },
});

// GET    /api/resume-versions                        → list all versions
router.get('/',                          authGuard, javaProxy);

// POST   /api/resume-versions                        → create text-based version
router.post('/',                         authGuard, javaProxy);

// POST   /api/resume-versions/upload                 → upload resume file (was missing)
router.post('/upload',                   authGuard, upload.single('resume'), javaProxy);

// ⚠️  Specific routes MUST come before /:id
// GET    /api/resume-versions/compare/:leftId/:rightId → diff two versions
router.get('/compare/:leftId/:rightId',  authGuard, javaProxy);

// GET    /api/resume-versions/recommend               → AI-recommended best version
router.get('/recommend',                 authGuard, javaProxy);

// GET    /api/resume-versions/:id                     → single version
router.get('/:id',                       authGuard, javaProxy);

// PUT    /api/resume-versions/:id                     → update version metadata
router.put('/:id',                       authGuard, javaProxy);

// POST   /api/resume-versions/:id/outcome             → record application outcome
router.post('/:id/outcome',              authGuard, javaProxy);

// DELETE /api/resume-versions/:id                     → delete version
router.delete('/:id',                    authGuard, javaProxy);

export default router;
