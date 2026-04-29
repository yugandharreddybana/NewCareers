import axios from 'axios';

const BASE = process.env.JAVA_BACKEND_URL || 'http://localhost:8080';
const TRUST_HEADER = process.env.INTERNAL_TRUST_HEADER || 'X-Internal-User-Id';
const TRUST_SECRET = process.env.INTERNAL_TRUST_SECRET;

const client = axios.create({
  baseURL: BASE,
  timeout: 90_000,
  validateStatus: () => true,
});

function buildHeaders(userId, extra = {}) {
  const h = { ...extra };
  if (userId) {
    h[TRUST_HEADER] = userId;
    h['X-Internal-Secret'] = TRUST_SECRET;
  }
  return h;
}

export async function forward({ method = 'GET', path, userId, data, params, headers, responseType }) {
  const res = await client.request({
    method, url: path, params, data, responseType,
    headers: buildHeaders(userId, headers || {}),
  });
  return res;
}

export function bubble(res, target) {
  target.status(res.status);
  if (res.headers['content-type']) target.setHeader('content-type', res.headers['content-type']);
  return target.send(res.data);
}
