import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { prepareForwardBody } from '../src/services/backendProxy.js';
import { signInternalRequest } from '../src/services/internalHmac.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const secret = fs.readFileSync(path.join(repoRoot, '.env'), 'utf8')
  .match(/^APP_INTERNAL_SECRET=(.*)$/m)![1].trim();

const fd = new FormData();
fd.append('file', Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(200)]), {
  filename: 't.pdf',
  contentType: 'application/pdf',
});

const { requestBody, bodyText, formHeaders } = await prepareForwardBody(fd);
const signed = signInternalRequest('POST', '/profile/cv', bodyText, secret)!;
const buf = requestBody as Buffer;

const outDir = path.join(repoRoot, 'backend/src/test/resources');
fs.writeFileSync(path.join(outDir, 'probe-multipart.bin'), buf);
fs.writeFileSync(path.join(outDir, 'probe-multipart.meta.json'), JSON.stringify({
  timestamp: signed.timestamp,
  signature: signed.signature,
  bodyLen: buf.length,
  contentType: formHeaders['content-type'],
}, null, 2));

console.log('wrote', buf.length, 'bytes', signed.signature.slice(0, 16));
