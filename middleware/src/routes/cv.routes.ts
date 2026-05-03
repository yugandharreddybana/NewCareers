import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json([]);
});

router.post('/upload', (_req, res) => {
  res.json({ success: true, message: 'CV uploaded successfully' });
});

export default router;
