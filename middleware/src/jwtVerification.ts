import { createPublicKey, type KeyObject } from 'crypto';
import jwt, { type JwtPayload as JsonWebTokenPayload } from 'jsonwebtoken';

export interface SessionJwtPayload extends JsonWebTokenPayload {
  sub: string;
  email?: string;
  role?: string;
}

let cachedVerificationKey: KeyObject | null = null;

function loadPublicKeyMaterial(): string {
  const raw = process.env.JWT_PUBLIC_KEY;
  if (!raw) {
    throw new Error('JWT_PUBLIC_KEY environment variable is not set');
  }
  return raw.replace(/\\n/g, '\n').trim();
}

function getVerificationKey(): KeyObject {
  if (cachedVerificationKey) {
    return cachedVerificationKey;
  }

  const material = loadPublicKeyMaterial();
  cachedVerificationKey = material.includes('BEGIN PUBLIC KEY')
    ? createPublicKey(material)
    : createPublicKey({
        key: Buffer.from(material, 'base64'),
        format: 'der',
        type: 'spki',
      });
  return cachedVerificationKey;
}

export function verifySessionToken(token: string): SessionJwtPayload {
  return jwt.verify(token, getVerificationKey(), {
    algorithms: ['RS256'],
    issuer: 'careerops',
    audience: 'web|mobile',
  }) as SessionJwtPayload;
}