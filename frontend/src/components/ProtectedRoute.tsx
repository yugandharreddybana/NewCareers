/**
 * ProtectedRoute.tsx
 * Guards all authenticated routes and wraps them in AppShell
 * (Navbar + Sidebar + BottomNav + page content).
 * Redirects unauthenticated users to /login.
 *
 * In development mode with VITE_DEV_BYPASS_GUARDS=true, skips auth checks.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { PageLoader } from '@/components/LoadingSpinner';

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_GUARDS === 'true' || import.meta.env.DEV || import.meta.env.MODE === 'development';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  // Dev bypass: skip all auth checks, render app shell directly
  if (DEV_BYPASS) {
    return <AppShell />;
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated: render the full app shell with nav/sidebar
  return <AppShell />;
}
