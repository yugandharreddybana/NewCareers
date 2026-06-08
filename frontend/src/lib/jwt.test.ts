import { describe, it, expect } from 'vitest';
import { isJwtExpired } from './jwt';

function makeJwt(exp: number | null, malformed = false): string {
  if (malformed) return 'not-a-jwt';
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify(exp != null ? { exp } : {}));
  return `${header}.${payload}.sig`;
}

describe('isJwtExpired', () => {
  it('returns false for a token expiring in the future', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(isJwtExpired(makeJwt(future))).toBe(false);
  });

  it('returns true for an expired token', () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(isJwtExpired(makeJwt(past))).toBe(true);
  });

  it('treats malformed tokens as expired', () => {
    expect(isJwtExpired('bad.token')).toBe(true);
    expect(isJwtExpired(makeJwt(null))).toBe(true);
  });
});
