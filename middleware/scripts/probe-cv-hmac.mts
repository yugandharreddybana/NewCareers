/**
 * Probes Java HMAC verification for multipart CV forwards (middleware → Java).
 * Usage: npx tsx scripts/probe-cv-hmac.mts [path-to-pdf]
 */
import axios from 'axios';
import crypto from 'crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import FormData from 'form-data';
import { prepareForwardBody, hmacSigningPath } from '../src/services/backendProxy.js';
import { signInternalRequest } from '../src/services/internalHmac.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const envPath = path.join(repoRoot, '.env');

function loadSecret(): string | undefined {
  if (process.env.APP_INTERNAL_SECRET) return process.env.APP_INTERNAL_SECRET;
  if (!fs.existsSync(envPath)) return undefined;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^APP_INTERNAL_SECRET=(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const secret = loadSecret();
if (!secret || secret.length < 32) {
  console.error('APP_INTERNAL_SECRET missing or too short in .env');
  process.exit(1);
}

const pdfPath = process.argv[2];
const fileBytes = pdfPath && fs.existsSync(pdfPath)
  ? fs.readFileSync(pdfPath)
  : Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(4096)]);

const fd = new FormData();
fd.append('file', fileBytes, {
  filename: 'probe-cv.pdf',
  contentType: 'application/pdf',
});

const { requestBody, bodyText, formHeaders } = await prepareForwardBody(fd);
const method = 'POST';
const signingPath = hmacSigningPath('/profile/cv');
const signed = signInternalRequest(method, signingPath, bodyText, secret);
if (!signed) {
  console.error('signInternalRequest returned null');
  process.exit(1);
}

const headers: Record<string, string> = {
  ...formHeaders,
  'X-Timestamp': signed.timestamp,
  'X-Signature': signed.signature,
  'X-Internal-User-Id': '00000000-0000-4000-8000-000000000001',
};

const javaRoot = (process.env.JAVA_BACKEND_URL || 'http://localhost:8080').replace(/\/api$/i, '');
const url = `${javaRoot}/api/profile/cv`;

console.log(JSON.stringify({
  signingPath,
  bodyLen: (requestBody as Buffer).length,
  bodyTextLen: bodyText.length,
  timestamp: signed.timestamp,
  signaturePrefix: signed.signature.slice(0, 16),
}, null, 2));

function postRaw(
  target: string,
  hdrs: Record<string, string>,
  body: Buffer,
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(target);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: 'POST',
        headers: { ...hdrs, 'Content-Length': String(body.length) },
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk as Buffer));
        res.on('end', () => resolve({
          status: res.statusCode ?? 0,
          data: Buffer.concat(chunks).toString('utf8'),
        }));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

const buf = requestBody as Buffer;

try {
  const raw = await postRaw(url, headers, buf);
  console.log('RAW_HTTP', raw.status, raw.data.slice(0, 300));

  const res = await axios.post(url, buf, {
    headers,
    validateStatus: () => true,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  console.log('AXIOS', res.status, typeof res.data === 'string' ? res.data.slice(0, 300) : res.data);
} catch (e) {
  console.error('REQUEST_FAILED', e);
  process.exit(1);
}
