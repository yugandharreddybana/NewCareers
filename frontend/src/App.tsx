/**
 * App.tsx — root router with NotFound catch-all added (Batch 3)
 *
 * Only the catch-all route was added here. All other routes are unchanged.
 * If App.tsx already imports NotFound, this diff is a no-op on those lines.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Suspense, lazy } from 'react';

// Pages
const Login           = lazy(() => import('@/pages/Login'));
const Register        = lazy(() => import('@/pages/Register'));
const ForgotPassword  = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword   = lazy(() => import('@/pages/ResetPassword'));
const Dashboard       = lazy(() => import('@/pages/Dashboard'));
const Kanban          = lazy(() => import('@/pages/Kanban'));
const Analytics       = lazy(() => import('@/pages/Analytics'));
const Skills          = lazy(() => import('@/pages/Skills'));
const CvManager       = lazy(() => import('@/pages/CvManager'));
const Profile         = lazy(() => import('@/pages/Profile'));
const AccountSettings = lazy(() => import('@/pages/AccountSettings'));
const BillingPage     = lazy(() => import('@/pages/BillingPage'));
const NotFound        = lazy(() => import('@/pages/NotFound'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-screen bg-bg" />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login"          element={<Login />} />
            <Route path="/register"       element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/kanban"     element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/skills"     element={<ProtectedRoute><Skills /></ProtectedRoute>} />
            <Route path="/cv"         element={<ProtectedRoute><CvManager /></ProtectedRoute>} />
            <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/account"    element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
            <Route path="/billing"    element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 catch-all — must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
