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

test('binary body signing matches Java ISO-8859-1 payload', () => {
  const timestamp = '1700000000000';
  const method = 'POST';
  const path = '/profile/cv';
  const binary = Buffer.from([0xff, 0xfe, 0x61]);
  const body = bytesForSigning(binary);

  const originalNow = Date.now;
  Date.now = () => Number(timestamp);
  try {
    const signed = signInternalRequest(method, path, body, TEST_SECRET);
    assert.ok(signed);
    assert.equal(signed!.signature, javaSign(timestamp, method, path, body));
    assert.equal(
      signed!.signature,
      'e35fc74380536ed1b9be9fd7cb6386ccc1cbad3d4f6aad6e561c374002d2c642',
    );
  } finally {
    Date.now = originalNow;
  }
});

test('HMAC path must exclude query string (Java servlet path has no query)', () => {
  const timestamp = '1700000000000';
  const method = 'GET';
  const pathWithoutQuery = '/account/security/activity';
  const pathWithQuery = '/account/security/activity?page=0&size=5';

  const signedCanonical = javaSign(timestamp, method, pathWithoutQuery, '');
  const signedWithQuery = javaSign(timestamp, method, pathWithQuery, '');

  assert.notEqual(signedCanonical, signedWithQuery);
});
