import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import { authGuard } from '../middleware/authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => {
    const ok = /\.(pdf|docx)$/i.test(f.originalname);
    if (!ok) return cb(new Error('Only PDF or DOCX'));
    cb(null, true);
  }
});

router.use(authGuard);

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

router.post('/cv', upload.single('file'), async (req, res, next) => {
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

router.get('/stats', async (req, res, next) => {
  try {
    const r = await forward({ path: '/profile/stats', userId: req.userId });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
