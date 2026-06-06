import axios, { type AxiosInstance, type ResponseType } from 'axios';
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  bodyForSigning,
  SIGNATURE_HEADER,
  signInternalRequest,
  TIMESTAMP_HEADER,
} from './internalHmac.js';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Socket } from 'net';

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

function javaBackendBase(): string {
  return stripTrailingSlash(
    process.env.JAVA_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080',
  );
}

const TRUST_HEADER = process.env.INTERNAL_TRUST_HEADER || 'X-Internal-User-Id';

/**
 * Default client timeout. Set high enough to accommodate long-running AI
 * skills (e.g. tailor-resume) without the middleware timing out before
 * Java does. Individual routes can override via createJavaRouteProxy.
 */
const DEFAULT_TIMEOUT_MS = 200_000;
/** tailor-resume can exceed 3 minutes on a single NVIDIA pass + HTML render. */
const TAILOR_RESUME_TIMEOUT_MS = 420_000;

let apiClient: AxiosInstance | null = null;

function getApiClient(): AxiosInstance {
  if (!apiClient) {
    apiClient = axios.create({
      // Java uses server.servlet.context-path=/api; controllers map /jobs, /auth, etc.
      // Middleware exposes /api/v1/* to the browser but must not add /v1 on the Java hop.
      baseURL: `${javaBackendBase()}/api`,
      timeout: DEFAULT_TIMEOUT_MS,
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
  timeoutMs,
}: {
  method?: string;
  path: string;
  userId?: string;
  data?: unknown;
  params?: unknown;
  headers?: Record<string, unknown>;
  responseType?: ResponseType;
  ip?: string;
  /** Override the default timeout for this request only. */
  timeoutMs?: number;
}) {
  const finalHeaders = buildHeaders(userId, headers || {});
  if (ip) finalHeaders['X-Forwarded-For'] = ip;

  const bodyText = bodyForSigning(data);
  const signed = signInternalRequest(method, path, bodyText);
  if (signed) {
    finalHeaders[TIMESTAMP_HEADER] = signed.timestamp;
    finalHeaders[SIGNATURE_HEADER] = signed.signature;
  }

  // Axios may omit JSON bodies on DELETE unless serialized with Content-Type set.
  const serializedBody =
    data === undefined || data === null
      ? undefined
      : typeof data === 'string'
        ? data
        : JSON.stringify(data);
  if (serializedBody !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  return getApiClient().request({
    method,
    url: path,
    params,
    data: serializedBody,
    responseType,
    headers: finalHeaders,
    // Per-request timeout overrides the singleton default when provided.
    ...(timeoutMs != null ? { timeout: timeoutMs } : {}),
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
 * Express handler that forwards to Java using servlet paths under /api (no /v1).
 * Use when the middleware mount path differs from Java (e.g. auto-apply).
 */
export function createJavaRouteProxy(
  javaPath: string,
  options: { errorMessage?: string; timeoutMs?: number } = {},
) {
  const prefix = javaPath.startsWith('/') ? javaPath : `/${javaPath}`;
  const { timeoutMs } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suffix = req.path === '/' ? '' : req.path;
      const path = `${prefix}${suffix}`.replace(/\{2}+/g, '/');
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
        timeoutMs,
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

      const body = forwardData as { skillName?: string; skill?: string } | undefined;
      const isTailorResume =
        req.method === 'POST'
        && (servletPath === '/skills/start'
          || servletPath === '/skills/tailor-resume/run')
        && (body?.skillName === 'tailor-resume' || body?.skill === 'tailor-resume');

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
        timeoutMs: isTailorResume ? TAILOR_RESUME_TIMEOUT_MS : undefined,
      });
      bubble(response, res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Unified proxy error:', message);
      res.status(502).json({ error: 'Backend unavailable', details: message });
    }
  };
}
