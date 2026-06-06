import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStore } from './tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    tokenStore.clear();
    sessionStorage.clear();
  });

  it('stores refresh in sessionStorage for tab sessions', () => {
    tokenStore.set('access-a', 'refresh-a');
    expect(tokenStore.getAccess()).toBe('access-a');
    expect(tokenStore.getRefresh()).toBe('refresh-a');
    expect(tokenStore.usesCookieRefresh()).toBe(false);
    expect(sessionStorage.getItem('co_refresh_v2')).toBe('refresh-a');
  });

  it('uses cookie mode for remember-me logins', () => {
    tokenStore.setAccessOnly('access-b');
    tokenStore.setRefreshViaCookie(true);
    expect(tokenStore.getAccess()).toBe('access-b');
    expect(tokenStore.getRefresh()).toBeNull();
    expect(tokenStore.hasRefreshOrCookie()).toBe(true);
    expect(sessionStorage.getItem('co_refresh_v2')).toBeNull();
  });
});
