import assert from 'node:assert/strict';
import test from 'node:test';
import FormData from 'form-data';
import { isMultipartFormData, prepareForwardBody } from './backendProxy.js';

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

test('prepareForwardBody JSON-serializes plain objects', async () => {
  const { requestBody, bodyText, formHeaders } = await prepareForwardBody({ limit: 10 });
  assert.equal(requestBody, '{"limit":10}');
  assert.equal(bodyText, '{"limit":10}');
  assert.deepEqual(formHeaders, {});
});
