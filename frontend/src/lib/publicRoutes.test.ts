import { describe, expect, it } from 'vitest';
import { isPublicFrontendPath, LOGIN_SESSION_EXPIRED_PATH, PUBLIC_FRONTEND_PATHS } from '@/lib/publicRoutes';

describe('publicRoutes', () => {
  it('treats landing and marketing paths as public', () => {
    expect(PUBLIC_FRONTEND_PATHS.has('/')).toBe(true);
    expect(PUBLIC_FRONTEND_PATHS.has('/billing')).toBe(true);
    expect(PUBLIC_FRONTEND_PATHS.has('/pricing')).toBe(true);
    expect(isPublicFrontendPath('/')).toBe(true);
    expect(isPublicFrontendPath('/get-started')).toBe(true);
  });

  it('keeps app paths protected', () => {
    expect(isPublicFrontendPath('/dashboard')).toBe(false);
    expect(isPublicFrontendPath('/account/profile')).toBe(false);
    expect(isPublicFrontendPath('/jobs')).toBe(false);
  });

  it('exposes the session-expired login redirect target', () => {
    expect(LOGIN_SESSION_EXPIRED_PATH).toBe('/login?reason=session_expired');
  });
});
