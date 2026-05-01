import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import { authGuard } from '../middleware/authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();

// CV upload filter (PDF / DOCX only, 5 MB)
const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => {
    const ok = /\.(pdf|docx)$/i.test(f.originalname);
    if (!ok) return cb(new Error('Only PDF or DOCX'));
    cb(null, true);
  }
});

// LinkedIn ZIP upload filter (ZIP only, 10 MB)
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => {
    const ok = /\.zip$/i.test(f.originalname);
    if (!ok) return cb(new Error('Only ZIP files are accepted'));
    cb(null, true);
  }
});

router.use(authGuard);

// ── Core profile ──────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const r = await forward({ path: '/profile', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
  try {
    const r = await forward({ method: 'PUT', path: '/profile', userId: req.userId, data: req.body });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── Portfolio CRUD ─────────────────────────────────────────────────────

// POST /api/profile/portfolio — add portfolio project
router.post('/portfolio', async (req, res, next) => {
  try {
    const r = await forward({ method: 'POST', path: '/profile/portfolio', userId: req.userId, data: req.body });
    bubble(r, res);
  } catch (e) { next(e); }
});

// PUT /api/profile/portfolio/:id — update portfolio project
router.put('/portfolio/:id', async (req, res, next) => {
  try {
    const r = await forward({ method: 'PUT', path: `/profile/portfolio/${req.params.id}`, userId: req.userId, data: req.body });
    bubble(r, res);
  } catch (e) { next(e); }
});

// DELETE /api/profile/portfolio/:id — remove portfolio project
router.delete('/portfolio/:id', async (req, res, next) => {
  try {
    const r = await forward({ method: 'DELETE', path: `/profile/portfolio/${req.params.id}`, userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── CV endpoints ────────────────────────────────────────────────────────
router.post('/cv', cvUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const fd = new FormData();
    fd.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
    const r = await forward({
      method: 'POST', path: '/profile/cv', userId: req.userId,
      data: fd, headers: fd.getHeaders()
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.get('/cv/download', async (req, res, next) => {
  try {
    const r = await forward({ path: '/profile/cv/download', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── Stats ────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const r = await forward({ path: '/profile/stats', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── LinkedIn import (Task 111) ──────────────────────────────────────────
// POST /api/profile/import/linkedin — accepts ZIP, forwards multipart to backend
router.post('/import/linkedin', zipUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No ZIP file provided' });
    const fd = new FormData();
    fd.append('file', req.file.buffer, {
      filename:    req.file.originalname || 'linkedin-export.zip',
      contentType: 'application/zip',
    });
    const r = await forward({
      method:  'POST',
      path:    '/profile/import/linkedin',
      userId:  req.userId,
      data:    fd,
      headers: fd.getHeaders(),
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
