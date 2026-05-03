/**
 * resume-versions.routes.ts — resume version management
 *
 * Batch 3: added Supabase file upload / download / delete routes.
 *   POST   /api/resume-versions/:id/upload    -> upload file to Supabase bucket
 *   GET    /api/resume-versions/:id/download  -> signed download URL
 *   DELETE /api/resume-versions/:id/file      -> remove file, keep metadata row
 */
import express from 'express';
import multer from 'multer';
import { authGuard } from '../authGuard.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();
const JAVA = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';

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
      (res as express.Response).status(502).json({ error: 'Backend unavailable', details: err.message });
    },
  },
});

// GET    /api/resume-versions                          -> list all versions
router.get('/',                           authGuard, javaProxy);

// POST   /api/resume-versions                          -> create text-based version
router.post('/',                          authGuard, javaProxy);

// Specific routes MUST come before /:id

// GET    /api/resume-versions/compare/:leftId/:rightId -> diff two versions
router.get('/compare/:leftId/:rightId',   authGuard, javaProxy);

// GET    /api/resume-versions/recommend                -> best version for role type
router.get('/recommend',                  authGuard, javaProxy);

// GET    /api/resume-versions/:id                      -> single version
router.get('/:id',                        authGuard, javaProxy);

// PUT    /api/resume-versions/:id                      -> update metadata
router.put('/:id',                        authGuard, javaProxy);

// POST   /api/resume-versions/:id/upload               -> upload file to Supabase
router.post('/:id/upload',                authGuard, upload.single('file'), javaProxy);

// GET    /api/resume-versions/:id/download             -> signed download URL
router.get('/:id/download',               authGuard, javaProxy);

// DELETE /api/resume-versions/:id/file                 -> remove file, keep metadata
router.delete('/:id/file',                authGuard, javaProxy);

// POST   /api/resume-versions/:id/outcome              -> record application outcome
router.post('/:id/outcome',               authGuard, javaProxy);

// DELETE /api/resume-versions/:id                      -> delete version + file
router.delete('/:id',                     authGuard, javaProxy);

export default router;
