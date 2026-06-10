import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import { isCsrfExempt, strictCsrfRequired } from './apiProtection.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/checkout-session',
    originalUrl: '/api/billing/checkout-session',
    cookies: {},
    headers: {},
    ...overrides,
  } as Request;
}

test('isCsrfExempt matches legacy and v1 billing webhook paths', () => {
  assert.equal(isCsrfExempt(mockReq({ originalUrl: '/api/v1/billing/webhook' })), true);
  assert.equal(isCsrfExempt(mockReq({ originalUrl: '/api/billing/webhook' })), true);
  assert.equal(isCsrfExempt(mockReq({ originalUrl: '/api/v1/billing/checkout-session' })), false);
});

test('strictCsrfRequired is true in production and staging', () => {
  const prev = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.equal(strictCsrfRequired(), true);
    process.env.NODE_ENV = 'staging';
    assert.equal(strictCsrfRequired(), true);
    process.env.NODE_ENV = 'development';
    assert.equal(strictCsrfRequired(), false);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
