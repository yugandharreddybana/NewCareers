/**
 * ProtectedRoute.tsx
 * Guards all authenticated routes and wraps them in AppShell.
 * Redirects unauthenticated users to /login, preserving the intended destination.
 *
 * AdminRoute extends ProtectedRoute with role === 'ADMIN' enforcement.
 *
 * G11 fix (Batch 7c): added onboarding redirect guard. If the user is
 * authenticated but has not completed onboarding, they are redirected to
 * /onboarding — EXCEPT when they are already on /onboarding, which would
 * otherwise create an infinite redirect loop.
 *
 * DEV_BYPASS: only active when VITE_DEV_BYPASS_GUARDS=true is explicitly set.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { PageLoader } from '@/components/LoadingSpinner';

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_GUARDS === 'true';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (DEV_BYPASS) {
    return <AppShell />;
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // G11 fix: redirect to onboarding if not yet completed, but avoid an
  // infinite loop by exempting the /onboarding route itself.
  if (!user.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppShell />;
}

/**
 * AdminRoute — requires role === 'ADMIN'.
 * Non-admin authenticated users are redirected to /dashboard.
 * Unauthenticated users are redirected to /login with return path preserved.
 */
export function AdminRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (DEV_BYPASS) {
    return <AppShell />;
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppShell />;
}
