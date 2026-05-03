/**
 * ProtectedRoute.tsx
 * Guards all authenticated routes and wraps them in AppShell
 * (Navbar + Sidebar + BottomNav + page content).
 * Redirects unauthenticated users to /login, preserving the intended destination.
 *
 * AdminRoute extends ProtectedRoute with role === 'ADMIN' enforcement.
 *
 * In development mode with VITE_DEV_BYPASS_GUARDS=true, skips auth checks.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { PageLoader } from '@/components/LoadingSpinner';

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_GUARDS === 'true' || import.meta.env.DEV || import.meta.env.MODE === 'development';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Dev bypass: skip all auth checks, render app shell directly
  if (DEV_BYPASS) {
    return <AppShell />;
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    // Fix #5: Capture the full location (pathname + search + hash) for post-login redirect
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Authenticated: render the full app shell with nav/sidebar
  return <AppShell />;
}

/**
 * AdminRoute — wraps ProtectedRoute logic + requires role === 'ADMIN'.
 * Non-admin users are redirected to /dashboard with a notification.
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
