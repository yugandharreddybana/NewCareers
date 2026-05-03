import jwt from 'jsonwebtoken';

const COOKIE = process.env.COOKIE_NAME || 'co_session';

export function authGuard(req, res, next) {
  const token =
    (req.cookies && req.cookies[COOKIE]) ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is not set');
    return res.status(500).json({ error: 'Internal server error: Auth configuration missing' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    req.email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}
