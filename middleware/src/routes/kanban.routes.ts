import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import { authGuard } from '../authGuard.js';
import { forward, bubble } from '../services/backendProxy.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authGuard);

router.patch('/:userJobId', async (req, res, next) => {
  try {
    const r = await forward({
      method: 'PATCH', path: `/kanban/${req.params.userJobId}`,
      userId: req.userId, data: req.body
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

router.post('/:userJobId/cv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const fd = new FormData();
    fd.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
    const r = await forward({
      method: 'POST', path: `/kanban/${req.params.userJobId}/cv`,
      userId: req.userId, data: fd, headers: fd.getHeaders()
    });
    bubble(r, res);
  } catch (e) { next(e); }
});

export default router;
