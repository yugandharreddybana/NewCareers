import { beforeEach, describe, expect, it } from 'vitest';
import { clearPendingGoogleLink, readPendingGoogleLink, writePendingGoogleLink } from './pendingGoogleLink';

describe('pendingGoogleLink', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearPendingGoogleLink();
  });

  it('keeps the Google id token in memory instead of sessionStorage', () => {
    writePendingGoogleLink('id-token');

    expect(readPendingGoogleLink()).toBe('id-token');
    expect(sessionStorage.getItem('co_google_link_v1')).toBeNull();
  });

  it('clears legacy persisted token storage', () => {
    sessionStorage.setItem('co_google_link_v1', 'legacy-token');

    clearPendingGoogleLink();

    expect(readPendingGoogleLink()).toBeNull();
    expect(sessionStorage.getItem('co_google_link_v1')).toBeNull();
  });
});
