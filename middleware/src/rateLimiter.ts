/**
 * rateLimiter.ts — rate limiter presets + CSRF guard
 *
 * A3 fix: csrfGuard strengthened — the old version accepted ANY request with
 *   Content-Type: application/json, which means any cross-origin form post
 *   that sets that header would pass. The guard now requires the custom
 *   X-Requested-With header that browsers never send cross-origin, making it
 *   a true CSRF barrier for non-Stripe routes.
 *
 *   Note: the primary CSRF defence is the double-submit cookie in server.ts.
 *   This csrfGuard is used only on auth.routes.ts as a defence-in-depth layer.
 *
 * A4 fix: Redis store support added via optional REDIS_URL env var.
 *   - If REDIS_URL is set: uses RedisStore (safe for multi-instance deploys).
 *   - If not set: falls back to in-memory store (single-instance / dev only).
 *   Install: npm install rate-limit-redis ioredis
 */
import { rateLimit, Options } from 'express-rate-limit';

// ── Redis store (optional — only wired up when REDIS_URL is present) ────────
let redisStore: Options['store'] | undefined;

if (process.env.REDIS_URL) {
  try {
    // Dynamic import keeps Redis optional — app still boots without it
    const { default: RedisStore } = await import('rate-limit-redis');
    const { default: Redis }      = await import('ioredis');
    const client = new Redis(process.env.REDIS_URL);
    redisStore = new RedisStore({
      // @ts-expect-error — sendCommand is the correct ioredis API
      sendCommand: (...args: string[]) => client.call(...args),
    });
    console.log('[rateLimiter] Using Redis store for rate limiting');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[rateLimiter] Redis store failed to initialise, falling back to memory:', msg);
  }
} else {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[rateLimiter] REDIS_URL must be set in production to prevent out-of-sync per-instance limits.');
  }
  console.warn(
    '[rateLimiter] REDIS_URL not set — using in-memory rate limit store. ' +
    'This resets on restart and is NOT safe for multi-instance deployments.',
  );
}

const base = (overrides: Partial<Options>): ReturnType<typeof rateLimit> =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...(redisStore ? { store: redisStore } : {}),
    ...overrides,
  });

// 20 attempts / 15 min — general auth routes (signup, forgot, reset)
export const authLimiter = base({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts. Try again later.' },
});

// 5 attempts / 15 min — login only (brute-force protection)
export const loginLimiter = base({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});

// 6 fetches / min — job scanning
export const fetchLimiter = base({
  windowMs: 60 * 1000,
  max: 6,
  message: { error: 'Slow down — too many job fetches. Wait a minute.' },
});

// 30 calls / min — AI skill calls
export const skillLimiter = base({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many skill calls. Wait a minute.' },
});

/**
 * A3 fix: CSRF guard strengthened.
 *
 * Old logic: passed if Content-Type was application/json — trivially bypassable
 * because an attacker can set Content-Type in a fetch() call from a malicious page.
 *
 * New logic: requires the X-Requested-With header, which browsers will NOT
 * automatically include on cross-origin requests initiated by forms or <img> tags.
 * Any modern fetch/XHR from our own frontend already sends this header.
 *
 * This is defence-in-depth alongside the double-submit CSRF cookie in server.ts.
 */
export function csrfGuard(req, res, next) {
  const SAFE = ['GET', 'HEAD', 'OPTIONS'];
  if (SAFE.includes(req.method)) return next();

  // Stripe webhooks sign their own payloads — skip CSRF for them
  if (req.path?.includes('/webhook')) return next();

  const xrw = req.headers['x-requested-with'];
  if (!xrw || String(xrw).toLowerCase() !== 'xmlhttprequest') {
    return res.status(403).json({
      error: 'CSRF validation failed: X-Requested-With header missing or invalid',
    });
  }
  next();
}
