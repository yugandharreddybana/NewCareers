/**
 * ProtectedRoute.tsx
 * Guards all authenticated routes and wraps them in AppShell
 * (Navbar + Sidebar + BottomNav + page content).
 * Redirects unauthenticated users to /login, preserving the intended destination.
 *
 * AdminRoute extends ProtectedRoute with role === 'ADMIN' enforcement.
 *
 * DEV_BYPASS: only active when VITE_DEV_BYPASS_GUARDS=true is explicitly set.
 * Does NOT auto-activate on import.meta.env.DEV or MODE=development.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { PageLoader } from '@/components/LoadingSpinner';

// IMPORTANT: Only bypass guards when the flag is EXPLICITLY set to the string 'true'.
// Do NOT use import.meta.env.DEV or MODE === 'development' — those would silently
// disable auth for every developer running the dev server, including AdminRoute.
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
