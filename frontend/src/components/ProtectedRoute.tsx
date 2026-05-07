/**
 * ProtectedRoute.tsx — auth guards for the React Router tree.
 *
 * Pass 6 fixes folded in:
 *   #6.004 / #6.037 — DEV_BYPASS comes from `lib/env.ts`. No more divergent
 *                    boolean derivations between AuthContext / Login / here.
 *   #6.005          — User.role is now populated by /auth/me; AdminRoute
 *                    correctly recognises administrators.
 *   #6.041          — ExperimentDashboardPage (and any future admin route)
 *                    is reachable for real admins.
 *   #6.047          — Non-admins navigating directly to /admin/* see a toast
 *                    explaining the redirect instead of silently bouncing.
 *
 * AppShell hosts the authenticated layout (sidebar, top bar, bottom nav).
 * Onboarding redirect: authenticated users without `onboarded` are funnelled
 * to /onboarding — except when they are already on it (avoids a redirect loop).
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { PageLoader } from '@/components/LoadingSpinner';
import { DEV_BYPASS } from '@/lib/env';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (DEV_BYPASS) return <AppShell />;

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

  // Onboarding gate. The /onboarding route is itself rendered inside this
  // ProtectedRoute, so we exempt that path to avoid a redirect loop.
  if (!user.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppShell />;
}

/**
 * AdminRoute — requires `user.role === 'ADMIN'`.
 * Non-admin authenticated users are redirected to /dashboard with a toast.
 */
export function AdminRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const toastShown = useRef(false);

  // We can't call hooks conditionally — the toast effect is always declared,
  // but only fires when we are about to redirect a non-admin. Pass 6 #6.047.
  const willDeny = !DEV_BYPASS && !loading && !!user && user.role !== 'ADMIN';

  useEffect(() => {
    if (willDeny && !toastShown.current) {
      toastShown.current = true;
      toast('Admin access required.', { icon: '🔒', duration: 4000 });
    }
  }, [willDeny]);

  if (DEV_BYPASS) return <AppShell />;
  if (loading)    return <PageLoader />;

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

// Default export so legacy imports (`import ProtectedRoute from ...`) keep working.
export default ProtectedRoute;

// Aliased <Outlet /> for any caller that imports it directly.
export const ProtectedOutlet = Outlet;
