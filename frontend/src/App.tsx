/**
 * App.tsx — root router with all routes (Upstream + Stashed changes)
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Suspense, lazy } from 'react';

// Pages
const Login                = lazy(() => import('@/pages/Login'));
const Signup               = lazy(() => import('@/pages/Signup'));
const ForgotPassword       = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword        = lazy(() => import('@/pages/ResetPassword'));
const Dashboard            = lazy(() => import('@/pages/Dashboard'));
const Kanban               = lazy(() => import('@/pages/Kanban'));
const Analytics            = lazy(() => import('@/pages/Analytics'));
const Skills               = lazy(() => import('@/pages/Skills'));
const CvManager            = lazy(() => import('@/pages/CvManager'));
const Profile              = lazy(() => import('@/pages/Profile'));
const AccountSettings      = lazy(() => import('@/pages/AccountSettings'));
const BillingPage          = lazy(() => import('@/pages/BillingPage'));
const NotFound             = lazy(() => import('@/pages/NotFound'));
const JobDetail            = lazy(() => import('@/pages/JobDetail'));
const Onboarding           = lazy(() => import('@/pages/Onboarding'));
const Refer                = lazy(() => import('@/pages/Refer'));

// Upstream Added Pages
const WorkspacePage        = lazy(() => import('@/pages/WorkspacePage'));
const ProgressPage         = lazy(() => import('@/pages/ProgressPage'));
const NetworkingPage       = lazy(() => import('@/pages/NetworkingPage'));
const ExperimentDashboard  = lazy(() => import('@/pages/ExperimentDashboardPage'));
const InterviewHistoryPage = lazy(() => import('@/pages/InterviewHistoryPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user)   return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login"           element={<Login />} />
        <Route path="/register"        element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Protected routes */}
        <Route path="/dashboard"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/kanban"            element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
        <Route path="/analytics"         element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/skills"            element={<ProtectedRoute><Skills /></ProtectedRoute>} />
        <Route path="/cv"                element={<ProtectedRoute><CvManager /></ProtectedRoute>} />
        <Route path="/profile"           element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/account"           element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
        <Route path="/billing"           element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
        <Route path="/jobs/:id"          element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
        <Route path="/onboarding"        element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/refer"             element={<ProtectedRoute><Refer /></ProtectedRoute>} />

        {/* Upstream Phase 3 Added Routes */}
        <Route path="/networking"        element={<ProtectedRoute><NetworkingPage /></ProtectedRoute>} />
        <Route path="/workspaces"        element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/progress"          element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
        <Route path="/admin/experiments" element={<ProtectedRoute><ExperimentDashboard /></ProtectedRoute>} />
        <Route path="/interviews"        element={<ProtectedRoute><InterviewHistoryPage /></ProtectedRoute>} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 catch-all — must be last */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
