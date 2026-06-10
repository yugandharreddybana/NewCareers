/**
 * Frontend paths that do not require authentication.
 * Used by session probe skip logic and auth-failure redirect gating.
 */
export const PUBLIC_FRONTEND_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/get-started',
  '/onboarding',
  '/privacy',
  '/terms',
  '/help',
  '/accessibility',
  '/billing',
  '/pricing',
]);

export const LOGIN_SESSION_EXPIRED_PATH = '/login?reason=session_expired';

export function isPublicFrontendPath(pathname: string): boolean {
  return PUBLIC_FRONTEND_PATHS.has(pathname);
}
