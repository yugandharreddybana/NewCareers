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
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { PageLoader } from '@/components/LoadingSpinner';

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

function loginRedirectTarget(
  user: { onboarded?: boolean },
  fromPath?: string,
): string {
  if (fromPath && !PUBLIC_AUTH_PATHS.has(fromPath) && fromPath !== '/') {
    return fromPath;
  }
  return user.onboarded ? '/dashboard' : '/onboarding';
}

/** Full-width layouts render without the sidebar shell (onboarding, welcome, job detail). */
function useFullWidthLayout(): boolean {
  const location = useLocation();
  const fullWidthPaths = ['/onboarding', '/welcome', '/dashboard', '/account', '/jobs', '/kanban'];
  return (
    fullWidthPaths.includes(location.pathname) || location.pathname.startsWith('/jobs/')
  );
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isFullWidth = useFullWidthLayout();

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

  // Onboarding gate — exempt /onboarding to avoid a redirect loop.
  if (!user.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (isFullWidth) {
    return <Outlet />;
  }

  return <AppShell />;
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
 * AdminRoute — requires `user.role === 'ADMIN'`.
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

  return <AppShell />;
}

export default ProtectedRoute;
export const ProtectedOutlet = Outlet;
