import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { bodyForSigning, bytesForSigning, signInternalRequest } from './internalHmac.js';

const TEST_SECRET = 'test-internal-trust-secret-minimum-32-characters-long';

function javaSign(timestamp: string, method: string, path: string, body: string): string {
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
  return createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
}

test('signInternalRequest matches Java canonical payload', () => {
  const timestamp = '1700000000000';
  const method = 'POST';
  const path = '/jobs/fetch';
  const body = '{"limit":10}';

  const originalNow = Date.now;
  Date.now = () => Number(timestamp);
  try {
    const signed = signInternalRequest(method, path, body, TEST_SECRET);
    assert.ok(signed);
    assert.equal(signed.timestamp, timestamp);
    assert.equal(signed.signature, javaSign(timestamp, method, path, body));
  } finally {
    Date.now = originalNow;
  }
});

test('bodyForSigning serializes objects like axios JSON', () => {
  assert.equal(bodyForSigning({ a: 1 }), '{"a":1}');
  assert.equal(bodyForSigning(undefined), '');
  const binary = Buffer.from([0xff, 0xfe, 0x61]);
  assert.equal(bodyForSigning(binary), bytesForSigning(binary));
});
