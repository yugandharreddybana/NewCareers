import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();

// CV upload: PDF/DOCX, max 5 MB
const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => {
    const ok = /\.(pdf|docx)$/i.test(f.originalname);
    cb(ok ? null : new Error('Only PDF or DOCX'), ok);
  },
});

// LinkedIn import: ZIP only, max 20 MB
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => {
    const ok = /\.zip$/i.test(f.originalname);
    cb(ok ? null : new Error('Only ZIP files are accepted'), ok);
  },
});

router.use(authGuard);

// ── Core profile ─────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const r = await forward({ path: '/profile', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'PUT', path: '/profile',
      userId: req.userId, data: req.body,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── CV ───────────────────────────────────────────────────────────

router.post('/cv', cvUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const fd = new FormData();
    fd.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    const r = await forward({
      method: 'POST', path: '/profile/cv',
      userId: req.userId, data: fd, headers: fd.getHeaders(),
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

// ── Stats ──────────────────────────────────────────────────────────

router.get('/stats', async (req, res, next) => {
  try {
    const r = await forward({ path: '/profile/stats', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── Portfolio CRUD ────────────────────────────────────────────────

router.post('/portfolio', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'POST', path: '/profile/portfolio',
      userId: req.userId, data: req.body,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.put('/portfolio/:itemId', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'PUT',
      path: `/profile/portfolio/${req.params.itemId}`,
      userId: req.userId, data: req.body,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.delete('/portfolio/:itemId', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'DELETE',
      path: `/profile/portfolio/${req.params.itemId}`,
      userId: req.userId,
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

// ── LinkedIn Import ───────────────────────────────────────────────

router.post('/import/linkedin', zipUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No ZIP file provided' });
    const fd = new FormData();
    fd.append('file', req.file.buffer, {
      filename: req.file.originalname || 'linkedin-export.zip',
      contentType: 'application/zip',
    });
    const r = await forward({
      method: 'POST', path: '/profile/import/linkedin',
      userId: req.userId, data: fd, headers: fd.getHeaders(),
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
