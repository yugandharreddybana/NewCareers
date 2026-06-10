/**
 * ProtectedRoute.tsx — auth guards for the React Router tree.
 *
 * ProtectedRoute — requires a valid session; unauthenticated users go to /login.
 * GuestRoute       — login/signup only; authenticated users are sent to the app.
 * AdminRoute       — requires ADMIN role.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/authCtx';
import { consumeSessionExpiredFlag } from '@/lib/onboardingSession';
import { LOGIN_SESSION_EXPIRED_PATH } from '@/lib/publicRoutes';
import { hasPendingSignup } from '@/lib/pendingSignup';
import { readWelcomePendingFlag } from '@/components/dashboard/CareersHomeDashboard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader } from '@/components/LoadingSpinner';
const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

/** Authenticated users may open these before onboarding completes (billing RBAC). */
export const ONBOARDING_EXEMPT_PATHS = new Set([
  '/account/billing',
  '/billing/success',
  '/billing/cancel',
]);

export function isOnboardingExemptPath(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PATHS.has(pathname);
}

const SAFE_REDIRECT_RE = /^\/[a-zA-Z0-9/_-]+$/;

/** Reject open redirects and auth-loop paths from `location.state.from`. */
export function safeRedirectPath(path?: string): string | null {
  if (!path || path === '/' || path.includes('//')) return null;
  if (!SAFE_REDIRECT_RE.test(path)) return null;
  if (PUBLIC_AUTH_PATHS.has(path)) return null;
  return path;
}

function loginRedirectTarget(
  user: { onboarded?: boolean },
  fromPath?: string,
): string {
  const safeFrom = safeRedirectPath(fromPath);
  if (safeFrom) return safeFrom;
  return user.onboarded ? '/dashboard' : '/onboarding';
}

/** Routes that render without DashboardLayout (onboarding, welcome redirect). */
function useLayoutlessRoute(): boolean {
  const location = useLocation();
  return location.pathname === '/onboarding' || location.pathname === '/welcome';
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isLayoutless = useLayoutlessRoute();

  if (loading) return <PageLoader />;

  if (!user) {
    const loginTarget = consumeSessionExpiredFlag()
      ? LOGIN_SESSION_EXPIRED_PATH
      : '/login';
    return (
      <Navigate
        to={loginTarget}
        replace
        state={{ from: location }}
      />
    );
  }

  // Onboarding gate — exempt /onboarding (loop) and billing paths (upgrade during setup).
  if (
    !user.onboarded
    && location.pathname !== '/onboarding'
    && !isOnboardingExemptPath(location.pathname)
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isLayoutless) {
    return <Outlet />;
  }

  return <DashboardLayout />;
}

/**
 * GuestRoute — for login, signup, and password-reset pages only.
 * Logged-in users are redirected into the app.
 */
export function GuestRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (user) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return (
      <Navigate
        to={loginRedirectTarget(user, from)}
        replace
      />
    );
  }

  return <Outlet />;
}

/**
 * OnboardingRoute — profile setup before or after account exists.
 * Guests may enter when they have deferred signup credentials; signed-in users
 * who are not onboarded may continue; everyone else is redirected.
 */
export function OnboardingRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (user?.onboarded) {
    const pending = readWelcomePendingFlag();
    return (
      <Navigate
        to={pending ? '/dashboard?welcome=1' : '/dashboard'}
        replace
      />
    );
  }

  if (!user && !hasPendingSignup()) {
    return (
      <Navigate
        to="/signup"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}

/**
 * AdminRoute — UX-only guard; requires `user.role === 'ADMIN'`.
 * Backend admin endpoints enforce {@code @PreAuthorize} / middleware role checks (M-19).
 * Non-admin authenticated users are redirected to /dashboard with a toast.
 */
export function AdminRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const toastShown = useRef(false);

  const willDeny = !loading && !!user && user.role !== 'ADMIN';

  useEffect(() => {
    if (willDeny && !toastShown.current) {
      toastShown.current = true;
      toast('Admin access required.', { icon: '🔒', duration: 4000 });
    }
  }, [willDeny]);

  if (loading) return <PageLoader />;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <DashboardLayout />;
}

export default ProtectedRoute;
export const ProtectedOutlet = Outlet;
