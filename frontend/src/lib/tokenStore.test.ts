import { beforeEach, describe, expect, it } from 'vitest';
import { tokenStore } from './tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    tokenStore.clear();
  });

  it('stores access in memory and marks refresh as cookie-backed', () => {
    tokenStore.setAccessOnly('access-a');
    expect(tokenStore.getAccess()).toBe('access-a');
    expect(tokenStore.getRefresh()).toBeNull();
    expect(tokenStore.usesCookieRefresh()).toBe(true);
    expect(sessionStorage.getItem('co_refresh_cookie_v2')).toBe('1');
  });

  it('clears access and cookie flag on logout', () => {
    tokenStore.setAccessOnly('access-a');
    tokenStore.clear();
    expect(tokenStore.getAccess()).toBeNull();
    expect(tokenStore.usesCookieRefresh()).toBe(false);
    expect(sessionStorage.getItem('co_refresh_cookie_v2')).toBeNull();
  });

  it('evicts legacy refresh keys from sessionStorage', () => {
    sessionStorage.setItem('co_refresh_v2', 'stale-refresh');
    tokenStore.setAccessOnly('access-x');
    expect(sessionStorage.getItem('co_refresh_v2')).toBeNull();
    expect(tokenStore.getRefresh()).toBeNull();
  });
});
