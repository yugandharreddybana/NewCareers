/**
 * cv.routes.ts — CV upload, history, download, delete
 *
 * Batch 3: wired to Supabase-backed CvService.
 * Multer accepts PDF/DOCX up to 10 MB in memory buffer,
 * then proxies to Java which stores in Supabase and parses text.
 */
import express from 'express';
import multer from 'multer';
import { authGuard } from '../authGuard.js';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();

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

const javaProxy = createJavaRouteProxy('/cv', {
  errorMessage: 'CV service unavailable',
  timeoutMs: 60_000,
});

// GET    /api/cv                   -> list all CVs (history), newest first
router.get('/',                    authGuard, javaProxy);

// POST   /api/cv/upload            -> upload CV to Supabase (multipart)
router.post('/upload',             authGuard, upload.single('file'), javaProxy);

// GET    /api/cv/:id/download      -> get signed Supabase download URL
router.get('/:id/download',        authGuard, javaProxy);

// PATCH  /api/cv/:id/activate      -> set as active CV
router.patch('/:id/activate',      authGuard, javaProxy);

// DELETE /api/cv/:id               -> delete CV from DB + Supabase bucket
router.delete('/:id',              authGuard, javaProxy);

export default router;
