import assert from 'node:assert/strict';
import test from 'node:test';
import { REMEMBER_FLAG_COOKIE, resolveRememberMe } from './authRememberMe.js';

test('resolveRememberMe prefers explicit body rememberMe (LSA-T20)', () => {
  assert.equal(resolveRememberMe({}, true), true);
  assert.equal(resolveRememberMe({}, false), false);
  assert.equal(resolveRememberMe({ [REMEMBER_FLAG_COOKIE]: '1' }, false), false);
  assert.equal(resolveRememberMe(undefined, true), true);
});

test('resolveRememberMe falls back to co_remember cookie', () => {
  assert.equal(resolveRememberMe({ [REMEMBER_FLAG_COOKIE]: '1' }), true);
  assert.equal(resolveRememberMe({ [REMEMBER_FLAG_COOKIE]: '0' }), false);
  assert.equal(resolveRememberMe({}), false);
  assert.equal(resolveRememberMe(undefined), false);
});
