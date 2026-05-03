/**
 * sanitize.ts — request sanitization middleware
 *
 * C6 fix: added stripXss() middleware that recursively strips HTML tags
 * and script-injectable characters from all string values in req.body.
 *
 * This is defence-in-depth alongside express-validator field validation.
 * It prevents stored XSS if a downstream Java service ever echoes user
 * input back into the UI without escaping.
 *
 * Deliberately lightweight: uses a simple regex rather than a heavy
 * HTML parser — the Java backend is responsible for rich content policy;
 * the middleware’s job is to strip obviously malicious payloads early.
 */
import { validationResult } from 'express-validator';

export function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input', details: errors.array() });
  }
  next();
}

export function trimStrings(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const k of Object.keys(req.body)) {
      if (typeof req.body[k] === 'string') req.body[k] = req.body[k].trim();
    }
  }
  next();
}

/**
 * C6 fix: strip HTML tags and common XSS vectors from all string fields
 * in req.body, recursively handling nested objects and arrays.
 *
 * Strips:
 *   <script>...</script> blocks and all other HTML tags
 *   javascript: and data: URI schemes
 *   on* event handler attributes (e.g. onerror=, onclick=)
 */
function sanitiseString(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')                        // strip all HTML tags
    .replace(/javascript\s*:/gi, '')                // strip javascript: URIs
    .replace(/data\s*:\s*text\s*\/\s*html/gi, '')   // strip data:text/html URIs
    .replace(/on\w+\s*=/gi, '');                    // strip on* event handlers
}

function sanitiseDeep(value: unknown): unknown {
  if (typeof value === 'string') return sanitiseString(value);
  if (Array.isArray(value))      return value.map(sanitiseDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitiseDeep(v);
    return out;
  }
  return value;
}

/**
 * Middleware: apply XSS sanitisation to req.body.
 * Safe to chain before or after trimStrings.
 * Does NOT modify multipart form data (files are handled by multer).
 */
export function stripXss(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitiseDeep(req.body);
  }
  next();
}
