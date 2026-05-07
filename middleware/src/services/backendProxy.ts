import axios from 'axios';
import crypto from 'crypto';

const BASE = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';
const TRUST_HEADER = process.env.INTERNAL_TRUST_HEADER || 'X-Internal-User-Id';
const TRUST_SECRET = process.env.INTERNAL_TRUST_SECRET;

const client = axios.create({
  baseURL: `${BASE}/api/v1`,
  timeout: 90_000,
  validateStatus: () => true, // 9.019 Note: Caller must manually verify r.status, or use forwardOrThrow()
});

function buildHeaders(userId, extra: any = {}) {
  const h = { ...extra };
  if (userId) {
    h[TRUST_HEADER] = userId;
    h['X-Internal-Secret'] = TRUST_SECRET;
  }
  
  // 9.018 Fix: Generate and forward X-Correlation-Id for cross-tier log tracking
  const correlationId = h['x-correlation-id'] || h['X-Correlation-Id'] || crypto.randomUUID();
  h['X-Correlation-Id'] = correlationId;
  
  return h;
}

export async function forward({ method = 'GET', path, userId, data, params, headers, responseType, ip }: {
  method?: string;
  path: string;
  userId?: string;
  data?: any;
  params?: any;
  headers?: any;
  responseType?: any;
  ip?: string;
}) {
  const finalHeaders = buildHeaders(userId, headers || {});
  if (ip) {
    finalHeaders['X-Forwarded-For'] = ip;
  }
  const res = await client.request({
    method, url: path, params, data, responseType,
    headers: finalHeaders,
  });
  return res;
}

/**
 * 9.019 Fix: Helper that automatically throws on any 4xx/5xx responses
 * for callers expecting Axios-like exception-throwing behavior.
 */
export async function forwardOrThrow(args: {
  method?: string;
  path: string;
  userId?: string;
  data?: any;
  params?: any;
  headers?: any;
  responseType?: any;
  ip?: string;
}) {
  const res = await forward(args);
  if (res.status >= 400) {
    const err = new Error(`Proxy request failed with status ${res.status}`);
    (err as any).status = res.status;
    (err as any).response = res;
    throw err;
  }
  return res;
}

export function bubble(res, target) {
  target.status(res.status);
  if (res.headers['content-type']) target.setHeader('content-type', res.headers['content-type']);
  
  // 9.018 Fix: Echo X-Correlation-Id back to the client in response headers
  const correlationId = res.config?.headers?.['X-Correlation-Id'];
  if (correlationId) {
    target.setHeader('X-Correlation-Id', correlationId);
  }
  
  return target.send(res.data);
}

/**
 * 9.030 Fix: Generic Express middleware that acts as a secure, unified replacement
 * for http-proxy-middleware (createProxyMiddleware) using forward() internally.
 */
export function proxyMiddleware() {
  return async (req: any, res: any) => {
    try {
      // Re-route path correctly
      const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
      
      // 9.037 Fix: Extract and forward client IP using X-Forwarded-For
      const clientIp = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress;

      const response = await forward({
        method: req.method,
        path,
        userId: req.user?.id,
        data: req.body,
        params: req.query,
        headers: req.headers,
        responseType: 'arraybuffer', // handles dynamic binary files like PDFs and JSON identically
        ip: clientIp,
      });
      bubble(response, res);
    } catch (err: any) {
      console.error('Unified proxy error:', err.message);
      res.status(502).json({ error: 'Backend unavailable', details: err.message });
    }
  };
}
