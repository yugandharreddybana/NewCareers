import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import { resolveClientIp, trustForwardedFor } from './trustedClientIp.js';

function mockReq(overrides: {
  remoteAddress?: string;
  ip?: string;
  xForwardedFor?: string;
}): Request {
  return {
    socket: { remoteAddress: overrides.remoteAddress ?? '203.0.113.10' },
    ip: overrides.ip ?? overrides.remoteAddress ?? '203.0.113.10',
    headers: overrides.xForwardedFor
      ? { 'x-forwarded-for': overrides.xForwardedFor }
      : {},
  } as Request;
}

test('trustForwardedFor is true when TRUSTED_PROXY=1', () => {
  const prev = process.env.TRUSTED_PROXY;
  process.env.TRUSTED_PROXY = '1';
  try {
    assert.equal(trustForwardedFor(mockReq({ remoteAddress: '203.0.113.10' })), true);
  } finally {
    if (prev === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = prev;
  }
});

test('trustForwardedFor is true for loopback peer without TRUSTED_PROXY', () => {
  const prev = process.env.TRUSTED_PROXY;
  delete process.env.TRUSTED_PROXY;
  try {
    assert.equal(trustForwardedFor(mockReq({ remoteAddress: '127.0.0.1' })), true);
  } finally {
    if (prev === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = prev;
  }
});

test('resolveClientIp ignores XFF when peer is not trusted', () => {
  const prev = process.env.TRUSTED_PROXY;
  delete process.env.TRUSTED_PROXY;
  try {
    const req = mockReq({
      remoteAddress: '203.0.113.10',
      xForwardedFor: '198.51.100.1, 203.0.113.10',
    });
    assert.equal(resolveClientIp(req), '203.0.113.10');
  } finally {
    if (prev === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = prev;
  }
});

test('resolveClientIp uses first XFF hop when trusted', () => {
  const prev = process.env.TRUSTED_PROXY;
  process.env.TRUSTED_PROXY = 'true';
  try {
    const req = mockReq({
      remoteAddress: '127.0.0.1',
      xForwardedFor: '198.51.100.1, 127.0.0.1',
    });
    assert.equal(resolveClientIp(req), '198.51.100.1');
  } finally {
    if (prev === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = prev;
  }
});
