import axios, { type AxiosInstance, type ResponseType } from 'axios';
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Socket } from 'net';

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

function javaBackendBase(): string {
  return stripTrailingSlash(
    process.env.JAVA_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080',
  );
}

const TRUST_HEADER = process.env.INTERNAL_TRUST_HEADER || 'X-Internal-User-Id';
const TRUST_SECRET = process.env.INTERNAL_TRUST_SECRET;

let apiClient: AxiosInstance | null = null;

function getApiClient(): AxiosInstance {
  if (!apiClient) {
    apiClient = axios.create({
      baseURL: `${javaBackendBase()}/api/v1`,
      timeout: 90_000,
      validateStatus: () => true,
    });
  }
  return apiClient;
}

function buildHeaders(userId: string | undefined, extra: Record<string, unknown> = {}) {
  const h: Record<string, string> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) {
      h[key] = String(value);
    }
  }
  if (userId) {
    h[TRUST_HEADER] = userId;
    if (TRUST_SECRET) h['X-Internal-Secret'] = TRUST_SECRET;
  }

  const correlationId =
    (h['x-correlation-id'] as string | undefined) ||
    (h['X-Correlation-Id'] as string | undefined) ||
    crypto.randomUUID();
  h['X-Correlation-Id'] = correlationId;

  return h;
}

export async function forward({
  method = 'GET',
  path,
  userId,
  data,
  params,
  headers,
  responseType,
  ip,
}: {
  method?: string;
  path: string;
  userId?: string;
  data?: unknown;
  params?: unknown;
  headers?: Record<string, unknown>;
  responseType?: ResponseType;
  ip?: string;
}) {
  const finalHeaders = buildHeaders(userId, headers || {});
  if (ip) finalHeaders['X-Forwarded-For'] = ip;

  return getApiClient().request({
    method,
    url: path,
    params,
    data,
    responseType,
    headers: finalHeaders,
  });
}

export async function forwardOrThrow(args: Parameters<typeof forward>[0]) {
  const res = await forward(args);
  if (res.status >= 400) {
    const err = new Error(`Proxy request failed with status ${res.status}`);
    (err as Error & { status: number; response: typeof res }).status = res.status;
    (err as Error & { response: typeof res }).response = res;
    throw err;
  }
  return res;
}

/** http-proxy-middleware error handler — narrows Socket vs Express Response. */
export function proxyOnError(
  message = 'Backend unavailable',
): (err: Error, req: Request | IncomingMessage, res: ServerResponse | Socket) => void {
  return (_err, _req, res) => {
    if (!res || !('status' in res) || typeof (res as Response).status !== 'function') {
      return;
    }
    const httpRes = res as Response;
    if (!httpRes.headersSent) {
      httpRes.status(502).json({ error: message, details: _err.message });
    }
  };
}

/**
 * Express handler that forwards to Java using the servlet path under /api/v1.
 * Use when the middleware mount path differs from Java (e.g. auto-apply).
 */
export function createJavaRouteProxy(
  javaPath: string,
  _options: { errorMessage?: string; timeoutMs?: number } = {},
) {
  const prefix = javaPath.startsWith('/') ? javaPath : `/${javaPath}`;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suffix = req.path === '/' ? '' : req.path;
      const path = `${prefix}${suffix}`.replace(/\/{2,}/g, '/');
      const clientIp =
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for']
          : undefined) ||
        req.ip;

      const response = await forward({
        method: req.method,
        path,
        userId: req.userId,
        data: req.body,
        params: req.query,
        headers: req.headers as Record<string, unknown>,
        ip: clientIp,
      });
      bubble(response, res);
    } catch (err) {
      next(err);
    }
  };
}

export function bubble(
  res: Awaited<ReturnType<typeof forward>>,
  target: Response,
) {
  target.status(res.status);
  if (res.headers['content-type']) {
    target.setHeader('content-type', res.headers['content-type'] as string);
  }
  if (res.headers['content-disposition']) {
    target.setHeader('content-disposition', res.headers['content-disposition'] as string);
  }

  const correlationId = res.config?.headers?.['X-Correlation-Id'];
  if (correlationId) {
    target.setHeader('X-Correlation-Id', String(correlationId));
  }

  let bodyData = res.data;
  if (bodyData instanceof ArrayBuffer) {
    bodyData = Buffer.from(bodyData);
  }

  return target.send(bodyData);
}

export function proxyMiddleware() {
  return async (req: Request, res: Response) => {
    try {
      const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
      const servletPath = path.replace(/^\/api\/v1/, '') || '/';
      const clientIp =
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for']
          : undefined) ||
        req.ip;

      const isEvaluationPdfRequest =
        req.method === 'POST' && servletPath === '/skills/pdf/evaluation-report';
      const forwardData = isEvaluationPdfRequest && req.rawBody
        ? req.rawBody
        : req.body;

      const response = await forward({
        method: req.method,
        path: servletPath,
        userId: (req as Request & { user?: { id?: string } }).user?.id ?? req.userId,
        data: forwardData,
        params: req.query,
        headers: {
          ...(req.headers as Record<string, unknown>),
          ...(isEvaluationPdfRequest ? { 'content-type': 'application/json' } : {}),
        },
        responseType: 'arraybuffer',
        ip: clientIp,
      });
      bubble(response, res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Unified proxy error:', message);
      res.status(502).json({ error: 'Backend unavailable', details: message });
    }
  };
}
