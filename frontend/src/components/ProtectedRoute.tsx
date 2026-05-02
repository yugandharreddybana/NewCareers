/**
 * ProtectedRoute.tsx
 * Guards all authenticated routes and wraps them in AppShell
 * (Navbar + Sidebar + BottomNav + page content).
 * Redirects unauthenticated users to /login.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated: render the full app shell with nav/sidebar
  return <AppShell />;
}
