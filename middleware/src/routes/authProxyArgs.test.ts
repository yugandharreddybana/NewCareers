import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import { buildRefreshForwardArgs, clientForwardHeaders } from './authProxyArgs.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    socket: { remoteAddress: '203.0.113.10' },
    ...overrides,
  } as Request;
}

test('clientForwardHeaders forwards User-Agent', () => {
  const headers = clientForwardHeaders(
    mockReq({ headers: { 'user-agent': 'CareerOps/1.0' } }),
  );
  assert.equal(headers['user-agent'], 'CareerOps/1.0');
});

test('buildRefreshForwardArgs forwards client IP and User-Agent', () => {
  const req = mockReq({
    headers: {
      'user-agent': 'Mozilla/5.0 Test',
      'x-forwarded-for': '198.51.100.1',
    },
    socket: { remoteAddress: '10.0.0.5' },
  });

  const args = buildRefreshForwardArgs(req, 'refresh-token-value');

  assert.equal(args.method, 'POST');
  assert.equal(args.path, '/auth/refresh');
  assert.deepEqual(args.data, { refreshToken: 'refresh-token-value' });
  assert.equal(args.ip, '10.0.0.5');
  assert.equal(args.headers['user-agent'], 'Mozilla/5.0 Test');
});
