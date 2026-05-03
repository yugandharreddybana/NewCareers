import { rateLimit } from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again later.' }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Strict 5 attempts limit for brute force protection
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

export const fetchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down — too many job fetches. Wait a minute.' }
});

export const skillLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many skill calls. Wait a minute.' }
});

// Basic CSRF Protection: Require a custom header that browsers won't automatically send cross-origin
export function csrfGuard(req, res, next) {
  // Only apply to state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'] || req.headers['content-type'];
    if (!customHeader || (req.headers['content-type'] !== 'application/json' && req.headers['content-type'] !== 'multipart/form-data')) {
      return res.status(403).json({ error: 'CSRF validation failed: Missing required headers' });
    }
  }
  next();
}
