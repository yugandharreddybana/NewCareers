/**
 * cv.routes.ts — CV upload, parsing, and storage
 *
 * Handles multipart file uploads via multer (stores in memory buffer)
 * then proxies to the Java backend which handles parsing, storage, and analysis.
 */
import express from 'express';
import multer from 'multer';
import { authGuard } from '../authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();
const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

// Multer config: 10 MB max, accept PDF/DOCX only
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
      res.status(502).json({ error: 'CV service unavailable', details: err.message });
    },
  },
});

// GET    /api/cv                  → list uploaded CVs
router.get('/',                   authGuard, javaProxy);

// POST   /api/cv/upload           → upload new CV (multipart form)
router.post('/upload',            authGuard, upload.single('cv'), javaProxy);

// GET    /api/cv/:id              → get single CV metadata
router.get('/:id',                authGuard, javaProxy);

// GET    /api/cv/:id/download     → download CV file
router.get('/:id/download',       authGuard, javaProxy);

// POST   /api/cv/:id/parse        → trigger CV parsing / skill extraction
router.post('/:id/parse',         authGuard, javaProxy);

// DELETE /api/cv/:id              → delete CV
router.delete('/:id',             authGuard, javaProxy);

// PUT    /api/cv/:id/active       → set as active CV
router.put('/:id/active',         authGuard, javaProxy);

export default router;
