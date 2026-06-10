import assert from 'node:assert/strict';
import test from 'node:test';
import FormData from 'form-data';
import { createHmac } from 'node:crypto';
import {
  hmacSigningPath,
  isMultipartFormData,
  prepareForwardBody,
  resolveJavaBackendRoot,
  sanitizeProxyHeaders,
} from './backendProxy.js';
import { bytesForSigning, signInternalRequest } from './internalHmac.js';

test('isMultipartFormData detects node form-data instances', () => {
  const fd = new FormData();
  fd.append('file', Buffer.from('%PDF-1.4'), {
    filename: 'cv.pdf',
    contentType: 'application/pdf',
  });
  assert.equal(isMultipartFormData(fd), true);
  assert.equal(isMultipartFormData({}), false);
  assert.equal(isMultipartFormData(undefined), false);
});

test('prepareForwardBody buffers FormData with multipart Content-Type', async () => {
  const fd = new FormData();
  const fileBytes = Buffer.from('%PDF-1.4 test content');
  fd.append('file', fileBytes, {
    filename: 'resume.pdf',
    contentType: 'application/pdf',
  });

  const { requestBody, bodyText, formHeaders } = await prepareForwardBody(fd);

  assert.ok(Buffer.isBuffer(requestBody));
  assert.ok(requestBody!.length > fileBytes.length);
  assert.match(String(formHeaders['content-type'] ?? ''), /^multipart\/form-data; boundary=/);
  assert.equal(bodyText, requestBody!.toString('latin1'));
  assert.match(requestBody!.toString('utf8'), /resume\.pdf/);
});

test('resolveJavaBackendRoot strips trailing /api from JAVA_BACKEND_URL', () => {
  const prev = process.env.JAVA_BACKEND_URL;
  process.env.JAVA_BACKEND_URL = 'http://backend:8080/api';
  try {
    assert.equal(resolveJavaBackendRoot(), 'http://backend:8080');
  } finally {
    if (prev === undefined) delete process.env.JAVA_BACKEND_URL;
    else process.env.JAVA_BACKEND_URL = prev;
  }
});

test('prepareForwardBody JSON-serializes plain objects', async () => {
  const { requestBody, bodyText, formHeaders } = await prepareForwardBody({ limit: 10 });
  assert.equal(requestBody, '{"limit":10}');
  assert.equal(bodyText, '{"limit":10}');
  assert.deepEqual(formHeaders, {});
});

test('prepareForwardBody JSON signing matches Java ISO-8859-1 for non-ASCII profile fields', async () => {
  const TEST_SECRET = 'test-internal-trust-secret-minimum-32-characters-long';
  const payload = { name: 'José', goalTitle: 'Développeur', onboarded: true };
  const { requestBody, bodyText } = await prepareForwardBody(payload);
  const json = JSON.stringify(payload);
  assert.equal(requestBody, json);
  assert.equal(bodyText, bytesForSigning(Buffer.from(json, 'utf8')));

  const timestamp = '1700000000000';
  const method = 'PUT';
  const path = '/profile';
  const javaPayload = `${timestamp}${method}${path}${bodyText}`;
  const javaSig = createHmac('sha256', TEST_SECRET).update(javaPayload).digest('hex');

  const originalNow = Date.now;
  Date.now = () => Number(timestamp);
  try {
    const signed = signInternalRequest(method, path, bodyText, TEST_SECRET);
    assert.ok(signed);
    assert.equal(signed!.signature, javaSig);
  } finally {
    Date.now = originalNow;
  }
});

test('sanitizeProxyHeaders strips cookie, authorization, and trust headers', () => {
  const headers = sanitizeProxyHeaders({
    cookie: 'co_session=abc',
    authorization: 'Bearer evil',
    'x-internal-user-id': 'spoofed',
    'user-agent': 'vitest',
    'x-correlation-id': 'corr-1',
  });
  assert.deepEqual(headers, {
    'user-agent': 'vitest',
    'x-correlation-id': 'corr-1',
  });
});

test('hmacSigningPath strips query string and hash for Java servlet-path verification', () => {
  assert.equal(hmacSigningPath('/account/security/activity?page=0&size=5'), '/account/security/activity');
  assert.equal(hmacSigningPath('/account/sessions'), '/account/sessions');
  assert.equal(hmacSigningPath('/path#fragment'), '/path');
});
