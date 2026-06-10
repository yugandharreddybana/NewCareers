import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStartupSecrets } from './startupValidation.js';

test('validateStartupSecrets exits when production secret is missing', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.APP_INTERNAL_SECRET;
  const prevExit = process.exit;

  process.env.NODE_ENV = 'production';
  delete process.env.APP_INTERNAL_SECRET;
  delete process.env.INTERNAL_TRUST_SECRET;

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    throw new Error(`exit:${code}`);
  }) as typeof process.exit;

  try {
    assert.throws(() => validateStartupSecrets(), /exit:1/);
    assert.equal(exitCode, 1);
  } finally {
    process.exit = prevExit;
    process.env.NODE_ENV = prevEnv;
    if (prevSecret === undefined) delete process.env.APP_INTERNAL_SECRET;
    else process.env.APP_INTERNAL_SECRET = prevSecret;
  }
});
